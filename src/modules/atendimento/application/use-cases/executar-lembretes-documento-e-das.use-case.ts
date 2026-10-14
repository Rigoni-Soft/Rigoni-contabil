import {
  comTentativas,
  ESPERA_MS,
  TENTATIVAS,
} from "@/modules/atendimento/application/com-tentativas";
import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  ExecutarLembretesDocumentoEDasPort,
  LembretesExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { RodadaLembretes } from "@/modules/atendimento/application/rodada-lembretes";
import type { EntregarComunicacaoPorCanais } from "@/modules/atendimento/application/use-cases/entregar-comunicacao-por-canais.use-case";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { formatarCompetencia, formatarDataIso } from "@/shared/kernel/data-iso";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { diaDoMes, hojeIso } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];

const nomeDoContato = (cliente: ClienteParaLembrete) => cliente.contato?.nome ?? cliente.empresa;

const temDestinatario = (cliente: ClienteParaLembrete) =>
  (formaEnvioUsaWhatsapp(cliente.formaEnvio) && cliente.contato !== null) ||
  (formaEnvioUsaEmail(cliente.formaEnvio) && cliente.email !== null);

// Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório,
// envia o DAS pronto pela forma de envio do Cliente e alerta o setor Simples Nacional do DAS que
// segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os
// demais. Falha de Serpro/WhatsApp tenta de novo antes de alertar.
// A entrega é precedida da reivindicação do DAS (pronto → enviado, atômica) e desfeita se falhar:
// duas execuções ou o Funcionário não geram envio em dobro, e uma falha não deixa o DAS "enviado".
// ponytail: processo que cai entre reivindicar e entregar deixa o DAS como enviado sem a guia ter
// saído; o Funcionário vê o DAS enviado e a auditoria da URA. Lease com retomada se isso doer.
export class ExecutarLembretesDocumentoEDas implements ExecutarLembretesDocumentoEDasPort {
  constructor(
    private readonly clientes: ClientesParaLembretePort,
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly entrega: EntregarComunicacaoPorCanais,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(): Promise<Result<LembretesExecutados, AppError>> {
    const agora = this.relogio.agora();
    const rodada = new RodadaLembretes(this.alertas, DIAS_DO_JOB.includes(diaDoMes(agora)));
    if (!rodada.resumo.executado) return ok(rodada.resumo);

    const lista = await this.clientes.listar();
    if (!lista.ok) return lista;
    for (const cliente of lista.value) await this.processar(cliente, agora, rodada);

    // Alerta que o job não renovou nesta rodada deixou de valer. A folga cobre a diferença entre o
    // relógio do servidor e o do banco; os alertas anteriores têm dias.
    const resolvidos = await this.alertas.resolverNaoRenovados(new Date(agora.getTime() - 60_000));
    if (!resolvidos.ok) rodada.resumo.falhas += 1;
    return ok(rodada.resumo);
  }

  private async processar(cliente: ClienteParaLembrete, agora: Date, rodada: RodadaLembretes) {
    if (cliente.documentoObrigatorio === "negativo") await this.lembrar(cliente, agora, rodada);
    if (cliente.dasStatus === "pronto") return this.enviarDas(cliente, agora, rodada);
    if (cliente.dasStatus === "pendente" && cliente.documentoObrigatorio === "positivo") {
      await rodada.alertar(
        cliente,
        "das_pendente",
        `DAS de ${cliente.empresa} segue pendente com o documento obrigatório em dia.`,
      );
    }
  }

  private async lembrar(cliente: ClienteParaLembrete, agora: Date, rodada: RodadaLembretes) {
    const comunicacao: ComunicacaoProativa = {
      tipo: "lembrete_documento_obrigatorio",
      contato: nomeDoContato(cliente),
      empresa: cliente.empresa,
    };
    if (await this.entrega.execute(cliente, comunicacao, agora, rodada)) {
      rodada.resumo.lembretes += 1;
    }
  }

  private async enviarDas(cliente: ClienteParaLembrete, agora: Date, rodada: RodadaLembretes) {
    // Sem para quem enviar não vale buscar a guia nem reivindicar o DAS.
    if (!temDestinatario(cliente)) {
      return rodada.alertar(
        cliente,
        "contato_ausente",
        `${cliente.empresa} não tem contato nem e-mail para a forma de envio.`,
      );
    }
    const reivindicado = await this.clientes.reivindicarDas(cliente.clienteId, hojeIso(agora));
    if (!reivindicado.ok) {
      return rodada.falhou(cliente, `DAS de ${cliente.empresa}: ${reivindicado.error.message}`);
    }
    // Outro job ou o Funcionário já tratou o DAS: quem não reivindicou não envia.
    if (!reivindicado.value) return;

    if (await this.entregarDas(cliente, agora, rodada)) {
      rodada.resumo.dasEnviados += 1;
      return;
    }
    await this.devolverDas(cliente, rodada);
  }

  private async devolverDas(cliente: ClienteParaLembrete, rodada: RodadaLembretes) {
    const desfeito = await this.clientes.desfazerDas(cliente.clienteId, cliente.dataEnvioDas);
    if (desfeito.ok) return;
    await rodada.falhou(
      cliente,
      `DAS de ${cliente.empresa} não voltou a pronto após a falha: ${desfeito.error.message}`,
    );
  }

  private async entregarDas(
    cliente: ClienteParaLembrete,
    agora: Date,
    rodada: RodadaLembretes,
  ): Promise<boolean> {
    const guia = await comTentativas(
      () => this.guiaPublicada(cliente),
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (!guia.ok) {
      await rodada.falhou(cliente, `DAS de ${cliente.empresa}: ${guia.error.message}`);
      return false;
    }
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_das",
      contato: nomeDoContato(cliente),
      empresa: cliente.empresa,
      ...guia.value,
    };
    return this.entrega.execute(cliente, comunicacao, agora, rodada);
  }

  // Busca a guia do DAS no provedor fiscal e a publica para o provedor de envio buscar por link.
  private async guiaPublicada(cliente: ClienteParaLembrete) {
    const buscada = await this.guias.buscar(cliente.clienteId, "das");
    if (!buscada.ok) return buscada;
    const { competencia, vencimento, nomeArquivo } = buscada.value;
    if (!competencia || !vencimento) {
      return err(new ServicoExternoError("Guia do DAS sem competência ou vencimento."));
    }
    const url = await this.publicadas.publicar(cliente.clienteId, buscada.value);
    if (!url.ok) return url;
    return ok({
      competencia: formatarCompetencia(competencia),
      vencimento: formatarDataIso(vencimento),
      guia: { url: url.value, nomeArquivo },
    });
  }
}

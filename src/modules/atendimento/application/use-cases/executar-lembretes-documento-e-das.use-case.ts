import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  AlertasDaRodada,
  EntregarComunicacaoPorCanaisPort,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  ExecutarLembretesDocumentoEDasPort,
  LembretesExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type {
  AlertaSetorPort,
  TipoAlertaSetor,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formatarCompetencia, formatarDataIso } from "@/shared/kernel/data-iso";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { diaDoMes, hojeIso } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];

// Diferença tolerada entre o relógio do servidor e o do banco ao resolver alertas.
const FOLGA_RELOGIO_MS = 60_000;

const nomeDoContato = (cliente: ClienteParaLembrete) => cliente.contato?.nome ?? cliente.empresa;

const temDestinatario = (cliente: ClienteParaLembrete) =>
  (formaEnvioUsaWhatsapp(cliente.formaEnvio) && cliente.contato !== null) ||
  (formaEnvioUsaEmail(cliente.formaEnvio) && cliente.email !== null);

// Estado de uma rodada do job: contadores do resumo e alertas já levantados por Cliente e tipo (um
// Cliente com lembrete e DAS não alerta duas vezes o mesmo problema). Nasce a cada execução, o que
// mantém o use case sem estado.
class RodadaLembretes implements AlertasDaRodada {
  private readonly contadores: LembretesExecutados;
  private readonly alertados = new Set<string>();

  constructor(
    private readonly alertas: AlertaSetorPort,
    executado: boolean,
  ) {
    this.contadores = { executado, lembretes: 0, dasEnviados: 0, alertas: 0, falhas: 0 };
  }

  // Cópia: quem lê o resumo não altera os contadores da rodada.
  get resumo(): LembretesExecutados {
    return { ...this.contadores };
  }

  registrarLembrete() {
    this.contadores.lembretes += 1;
  }

  registrarDasEnviado() {
    this.contadores.dasEnviados += 1;
  }

  registrarFalha() {
    this.contadores.falhas += 1;
  }

  async alertar(cliente: ClienteParaLembrete, tipo: TipoAlertaSetor, mensagem: string) {
    const chave = `${cliente.clienteId}:${tipo}`;
    if (this.alertados.has(chave)) return;
    this.alertados.add(chave);
    const gravado = await this.alertas.alertar({
      setor: "simples_nacional",
      tipo,
      clienteId: cliente.clienteId,
      mensagem,
    });
    if (gravado.ok) this.contadores.alertas += 1;
    else this.registrarFalha();
  }

  async falhou(cliente: ClienteParaLembrete, mensagem: string) {
    this.registrarFalha();
    await this.alertar(cliente, "falha_envio", mensagem);
  }
}

// Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório,
// envia o DAS pronto pela forma de envio do Cliente e alerta o setor Simples Nacional do DAS que
// segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os
// demais. Falha do provedor fiscal ou de mensagem tenta de novo antes de alertar.
// A entrega é precedida da reivindicação do DAS (pronto → enviado, atômica) e desfeita se falhar:
// duas execuções ou o Funcionário não geram envio em dobro, e uma falha não deixa o DAS "enviado".
// ponytail: processo que cai entre reivindicar e entregar deixa o DAS como enviado sem a guia ter
// saído; o Funcionário vê o DAS enviado e a auditoria da URA. Lease com retomada se isso doer.
export class ExecutarLembretesDocumentoEDas implements ExecutarLembretesDocumentoEDasPort {
  constructor(
    private readonly clientes: ClientesParaLembretePort,
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly entrega: EntregarComunicacaoPorCanaisPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(): Promise<Result<LembretesExecutados, AppError>> {
    const agora = this.relogio.agora();
    const rodada = new RodadaLembretes(this.alertas, DIAS_DO_JOB.includes(diaDoMes(agora)));
    if (!rodada.resumo.executado) return ok(rodada.resumo);

    const clientes = await this.clientes.listar();
    if (!clientes.ok) return clientes;
    for (const cliente of clientes.value) await this.processar(cliente, agora, rodada);

    // Alerta que o job não renovou nesta rodada deixou de valer. A folga cobre a diferença entre o
    // relógio do servidor e o do banco; os alertas anteriores têm dias.
    const resolvidos = await this.alertas.resolverNaoRenovados(
      new Date(agora.getTime() - FOLGA_RELOGIO_MS),
    );
    if (!resolvidos.ok) rodada.registrarFalha();
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
    if (await this.entrega.execute({ cliente, comunicacao, agora, rodada })) {
      rodada.registrarLembrete();
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
      rodada.registrarDasEnviado();
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
    return this.entrega.execute({ cliente, comunicacao, agora, rodada });
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

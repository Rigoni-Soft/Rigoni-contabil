import { comTentativas } from "@/modules/atendimento/application/com-tentativas";
import {
  montarMensagemLivre,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  ExecutarLembretesDocumentoEDasPort,
  LembretesExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type {
  AlertaSetor,
  AlertaSetorPort,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [1, 5, 10, 15];
const TENTATIVAS = 3;

const FORMATO_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const usaWhatsapp = (c: ClienteParaLembrete) => c.formaEnvio !== "email";
const usaEmail = (c: ClienteParaLembrete) => c.formaEnvio !== "whatsapp";

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
    private readonly proativa: EnviarComunicacaoProativa,
    private readonly email: EnvioEmailPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
    private readonly esperaEntreTentativasMs = 2000,
  ) {}

  // Alertas já levantados na rodada, por Cliente e tipo: um Cliente com lembrete e DAS não alerta
  // duas vezes o mesmo problema.
  private readonly alertados = new Set<string>();

  async execute(): Promise<Result<LembretesExecutados, AppError>> {
    const agora = this.relogio.agora();
    const hoje = FORMATO_DATA.format(agora);
    const resumo: LembretesExecutados = {
      executado: DIAS_DO_JOB.includes(Number(hoje.slice(8))),
      lembretes: 0,
      dasEnviados: 0,
      alertas: 0,
      falhas: 0,
    };
    if (!resumo.executado) return ok(resumo);

    const lista = await this.clientes.listar();
    if (!lista.ok) return lista;
    this.alertados.clear();
    for (const cliente of lista.value) {
      if (cliente.documentoObrigatorio === "negativo") {
        await this.lembrar(cliente, agora, resumo);
      }
      if (cliente.dasStatus === "pronto") {
        await this.enviarDas(cliente, agora, hoje, resumo);
      } else if (cliente.dasStatus === "pendente" && cliente.documentoObrigatorio === "positivo") {
        await this.alertar(
          cliente,
          "das_pendente",
          `DAS de ${cliente.empresa} segue pendente com o documento obrigatório em dia.`,
          resumo,
        );
      }
    }
    // Alerta que o job não renovou nesta rodada deixou de valer. A folga cobre a diferença entre o
    // relógio do servidor e o do banco; os alertas anteriores têm dias.
    const resolvidos = await this.alertas.resolverNaoRenovados(new Date(agora.getTime() - 60_000));
    if (!resolvidos.ok) resumo.falhas += 1;
    return ok(resumo);
  }

  private async lembrar(c: ClienteParaLembrete, agora: Date, resumo: LembretesExecutados) {
    const comunicacao: ComunicacaoProativa = {
      tipo: "lembrete_documento_obrigatorio",
      contato: c.contato?.nome ?? c.empresa,
      empresa: c.empresa,
    };
    if (await this.entregar(c, comunicacao, agora, resumo)) resumo.lembretes += 1;
  }

  private async enviarDas(
    c: ClienteParaLembrete,
    agora: Date,
    hoje: string,
    resumo: LembretesExecutados,
  ) {
    // Sem para quem enviar não vale buscar a guia nem reivindicar o DAS.
    const temDestino = (usaWhatsapp(c) && c.contato) || (usaEmail(c) && c.email);
    if (!temDestino) {
      return this.alertar(
        c,
        "contato_ausente",
        `${c.empresa} não tem contato nem e-mail para a forma de envio.`,
        resumo,
      );
    }

    const reivindicado = await this.clientes.reivindicarDas(c.clienteId, hoje);
    if (!reivindicado.ok) {
      return this.falhou(c, `DAS de ${c.empresa}: ${reivindicado.error.message}`, resumo);
    }
    // Outro job ou o Funcionário já tratou o DAS: quem não reivindicou não envia.
    if (!reivindicado.value) return;

    if (await this.entregarDas(c, agora, resumo)) {
      resumo.dasEnviados += 1;
      return;
    }
    const desfeito = await this.clientes.desfazerDas(c.clienteId, c.dataEnvioDas);
    if (!desfeito.ok) {
      await this.falhou(
        c,
        `DAS de ${c.empresa} não voltou a pronto após a falha: ${desfeito.error.message}`,
        resumo,
      );
    }
  }

  private async entregarDas(
    c: ClienteParaLembrete,
    agora: Date,
    resumo: LembretesExecutados,
  ): Promise<boolean> {
    const guia = await comTentativas(
      async () => {
        const buscada = await this.guias.buscar(c.clienteId, "das");
        if (!buscada.ok) return buscada;
        const { competencia, vencimento } = buscada.value;
        if (!competencia || !vencimento) {
          return err(new ServicoExternoError("Guia do DAS sem competência ou vencimento."));
        }
        const url = await this.publicadas.publicar(c.clienteId, buscada.value);
        if (!url.ok) return url;
        const [ano, mes] = competencia.split("-");
        return ok({
          url: url.value,
          nomeArquivo: buscada.value.nomeArquivo,
          competencia: `${mes}/${ano}`,
          vencimento: formatarDataIso(vencimento),
        });
      },
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (!guia.ok) {
      await this.falhou(c, `DAS de ${c.empresa}: ${guia.error.message}`, resumo);
      return false;
    }

    const { url, nomeArquivo, competencia, vencimento } = guia.value;
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_das",
      contato: c.contato?.nome ?? c.empresa,
      empresa: c.empresa,
      competencia,
      vencimento,
      guia: { url, nomeArquivo },
    };
    return this.entregar(c, comunicacao, agora, resumo);
  }

  // Entrega pelos canais da forma de envio; `true` se ao menos um entregou. Canal que não entrega
  // vira alerta, sem derrubar o outro.
  private async entregar(
    c: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    agora: Date,
    resumo: LembretesExecutados,
  ): Promise<boolean> {
    let entregue = false;
    if (usaWhatsapp(c)) {
      if (!c.contato) {
        await this.alertar(c, "contato_ausente", `${c.empresa} não tem contato padrão.`, resumo);
      } else {
        const { telefone } = c.contato;
        const enviado = await this.proativa.execute({
          telefone,
          comunicacao,
          ultimaMensagemDoContatoEm: c.ultimaMensagemDoContatoEm,
          agora,
        });
        if (enviado.ok) entregue = true;
        else await this.falhou(c, `WhatsApp de ${c.empresa}: ${enviado.error.message}`, resumo);
      }
    }
    if (usaEmail(c)) {
      if (!c.email) {
        await this.alertar(c, "contato_ausente", `${c.empresa} não tem e-mail.`, resumo);
      } else {
        const para = c.email;
        const { texto } = montarMensagemLivre(comunicacao, "");
        const anexo = "guia" in comunicacao ? comunicacao.guia : undefined;
        const tema = anexo ? "Guia do DAS" : "Documentos fiscais pendentes";
        const assunto = `${tema} — ${c.empresa}`;
        const enviado = await comTentativas(
          () => this.email.enviar({ para, assunto, texto, anexo }),
          TENTATIVAS,
          this.esperaEntreTentativasMs,
        );
        if (enviado.ok) entregue = true;
        else await this.falhou(c, `E-mail de ${c.empresa}: ${enviado.error.message}`, resumo);
      }
    }
    return entregue;
  }

  private async falhou(c: ClienteParaLembrete, mensagem: string, resumo: LembretesExecutados) {
    resumo.falhas += 1;
    await this.alertar(c, "falha_envio", mensagem, resumo);
  }

  private async alertar(
    c: ClienteParaLembrete,
    tipo: AlertaSetor["tipo"],
    mensagem: string,
    resumo: LembretesExecutados,
  ) {
    const chave = `${c.clienteId}:${tipo}`;
    if (this.alertados.has(chave)) return;
    this.alertados.add(chave);
    const gravado = await this.alertas.alertar({
      setor: "simples_nacional",
      tipo,
      clienteId: c.clienteId,
      mensagem,
    });
    if (gravado.ok) resumo.alertas += 1;
    else resumo.falhas += 1;
  }
}

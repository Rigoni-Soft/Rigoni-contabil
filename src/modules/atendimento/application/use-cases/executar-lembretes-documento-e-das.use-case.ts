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

const ASSUNTO = {
  lembrete_documento_obrigatorio: "Documentos fiscais pendentes",
  envio_guia_das: "Guia do DAS",
  envio_guia_parcelamento: "Guia de parcelamento",
} as const;

// Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório,
// envia o DAS pronto pela forma de envio do Cliente e alerta o setor Simples Nacional do DAS que
// segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os
// demais. Falha de Serpro/WhatsApp tenta de novo antes de alertar.
// ponytail: um segundo disparo simultâneo no mesmo dia pode reenviar; o cron roda uma vez por dia
// e o DAS vira "enviado" logo depois da entrega. Reivindicar a linha antes de enviar se preciso.
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
    const guia = await this.tentar(async () => {
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
    });
    if (!guia.ok) return this.falhou(c, `DAS de ${c.empresa}: ${guia.error.message}`, resumo);

    const { url, nomeArquivo, competencia, vencimento } = guia.value;
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_das",
      contato: c.contato?.nome ?? c.empresa,
      empresa: c.empresa,
      competencia,
      vencimento,
      guia: { url, nomeArquivo },
    };
    if (!(await this.entregar(c, comunicacao, agora, resumo))) return;

    const marcado = await this.clientes.marcarDasEnviado(c.clienteId, hoje);
    if (!marcado.ok) {
      return this.falhou(c, `DAS enviado, mas não marcado: ${marcado.error.message}`, resumo);
    }
    resumo.dasEnviados += 1;
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
    if (c.formaEnvio !== "email") {
      if (!c.contato) {
        await this.alertar(c, "contato_ausente", `${c.empresa} não tem contato padrão.`, resumo);
      } else {
        const { telefone } = c.contato;
        const enviado = await this.tentar(() =>
          this.proativa.execute({
            telefone,
            comunicacao,
            ultimaMensagemDoContatoEm: c.ultimaMensagemDoContatoEm,
            agora,
          }),
        );
        if (enviado.ok) entregue = true;
        else await this.falhou(c, `WhatsApp de ${c.empresa}: ${enviado.error.message}`, resumo);
      }
    }
    if (c.formaEnvio !== "whatsapp") {
      if (!c.email) {
        await this.alertar(c, "contato_ausente", `${c.empresa} não tem e-mail.`, resumo);
      } else {
        const para = c.email;
        const { texto } = montarMensagemLivre(comunicacao, "");
        const anexo = "guia" in comunicacao ? comunicacao.guia : undefined;
        const assunto = `${ASSUNTO[comunicacao.tipo]} — ${c.empresa}`;
        const enviado = await this.tentar(() => this.email.enviar({ para, assunto, texto, anexo }));
        if (enviado.ok) entregue = true;
        else await this.falhou(c, `E-mail de ${c.empresa}: ${enviado.error.message}`, resumo);
      }
    }
    return entregue;
  }

  // Só falha do serviço externo é transitória; o resto (sem autorização, destinatário inválido)
  // não melhora ao repetir.
  private async tentar<T>(
    operacao: () => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    let resultado = await operacao();
    for (let n = 1; n < TENTATIVAS && !resultado.ok; n += 1) {
      if (!(resultado.error instanceof ServicoExternoError)) break;
      await new Promise((resolve) => setTimeout(resolve, this.esperaEntreTentativasMs));
      resultado = await operacao();
    }
    return resultado;
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

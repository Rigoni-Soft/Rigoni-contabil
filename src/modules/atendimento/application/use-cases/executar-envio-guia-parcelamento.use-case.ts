import {
  temDestinatario,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  EntregarComunicacaoPorCanaisPort,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  EnvioGuiaParcelamentoExecutado,
  ExecutarEnvioGuiaParcelamentoPort,
} from "@/modules/atendimento/application/ports/in/executar-envio-guia-parcelamento.provider";
import type { ObterGuiaParcelamentoParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-parcelamento-para-envio.provider";
import type {
  AlertaSetorPort,
  TipoAlertaSetor,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaParcelamento,
  ClientesParaParcelamentoPort,
} from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { diaDoMes } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [20, 22, 24, 26, 28];

// Diferença tolerada entre o relógio do servidor e o do banco ao resolver alertas.
const FOLGA_RELOGIO_MS = 60_000;

type Andamento = { enviado: boolean; ocorrencias: OcorrenciaDeEntrega[] };

const falha = (mensagem: string): Andamento => ({
  enviado: false,
  ocorrencias: [{ tipo: "falha_envio", mensagem }],
});

// Um alerta por tipo e Cliente: mensagens do mesmo tipo se juntam, em vez de a segunda se perder.
function agruparPorTipo(ocorrencias: OcorrenciaDeEntrega[]): Map<TipoAlertaSetor, string[]> {
  const porTipo = new Map<TipoAlertaSetor, string[]>();
  for (const { tipo, mensagem } of ocorrencias) {
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), mensagem]);
  }
  return porTipo;
}

// Job dos dias 20/22/24/26/28 (fuso de São Paulo): envia a guia de parcelamento pela forma de
// envio do Cliente que tem Parcelamento pendente e o marca como enviado. Falha do provedor fiscal
// ou do envio repete (nas portas) antes de alertar o setor Simples Nacional, e o Parcelamento
// volta a pendente: a próxima rodada tenta de novo. O Parcelamento é reivindicado (pendente →
// enviado, atômico) antes da entrega: execuções simultâneas ou o Funcionário não geram envio em
// dobro. Cada Cliente é independente.
// ponytail: processo que cai entre reivindicar e entregar deixa o Parcelamento como enviado sem a
// guia ter saído; a auditoria da URA mostra o que houve. Lease com retomada se isso doer.
export class ExecutarEnvioGuiaParcelamento implements ExecutarEnvioGuiaParcelamentoPort {
  constructor(
    private readonly clientes: ClientesParaParcelamentoPort,
    private readonly guia: ObterGuiaParcelamentoParaEnvioPort,
    private readonly entrega: EntregarComunicacaoPorCanaisPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<EnvioGuiaParcelamentoExecutado, AppError>> {
    const agora = this.relogio.agora();
    const resumo: EnvioGuiaParcelamentoExecutado = {
      executado: DIAS_DO_JOB.includes(diaDoMes(agora)),
      enviados: 0,
      alertas: 0,
      falhas: 0,
    };
    if (!resumo.executado) return ok(resumo);

    const clientes = await this.clientes.listarPendentes();
    if (!clientes.ok) return clientes;

    let alertasNaoGravados = 0;
    for (const cliente of clientes.value) {
      const feito = await this.enviar(cliente, agora);
      resumo.enviados += Number(feito.enviado);
      resumo.falhas += feito.ocorrencias.filter((o) => o.tipo === "falha_envio").length;
      const gravacao = await this.levantarAlertas(cliente, feito.ocorrencias);
      resumo.alertas += gravacao.gravados;
      alertasNaoGravados += gravacao.naoGravados;
    }
    resumo.falhas += alertasNaoGravados;

    // Alerta que o job não renovou nesta rodada deixou de valer. Com alerta que não pôde ser
    // gravado a rodada não sabe o que renovou, então não resolve nada.
    if (alertasNaoGravados === 0) {
      const folga = new Date(agora.getTime() - FOLGA_RELOGIO_MS);
      const resolvidos = await this.alertas.resolverNaoRenovados(folga);
      if (!resolvidos.ok) resumo.falhas += 1;
    }
    return ok(resumo);
  }

  private async enviar(cliente: ClienteParaParcelamento, agora: Date): Promise<Andamento> {
    // Sem para quem enviar não vale buscar a guia nem reivindicar o Parcelamento.
    if (!temDestinatario(cliente)) {
      return {
        enviado: false,
        ocorrencias: [
          {
            tipo: "contato_ausente",
            mensagem: `${cliente.empresa} não tem contato nem e-mail para a forma de envio.`,
          },
        ],
      };
    }
    const reivindicado = await this.clientes.reivindicar(cliente.clienteId);
    if (!reivindicado.ok) {
      return falha(`Parcelamento de ${cliente.empresa}: ${reivindicado.error.message}`);
    }
    // Outro job ou o Funcionário já tratou o Parcelamento: quem não reivindicou não envia.
    if (!reivindicado.value) return { enviado: false, ocorrencias: [] };

    const entrega = await this.entregarGuia(cliente, agora);
    if (entrega.enviado) return entrega;

    const desfeito = await this.clientes.desfazer(cliente.clienteId);
    if (desfeito.ok) return entrega;
    const naoVoltou = `Parcelamento de ${cliente.empresa} não voltou a pendente após a falha: ${desfeito.error.message}`;
    return {
      enviado: false,
      ocorrencias: [...entrega.ocorrencias, ...falha(naoVoltou).ocorrencias],
    };
  }

  private async entregarGuia(cliente: ClienteParaParcelamento, agora: Date): Promise<Andamento> {
    const guia = await this.guia.execute(cliente.clienteId);
    if (!guia.ok) return falha(`Parcelamento de ${cliente.empresa}: ${guia.error.message}`);
    const comunicacao: ComunicacaoProativa = {
      tipo: "envio_guia_parcelamento",
      contato: cliente.contato?.nome ?? cliente.empresa,
      empresa: cliente.empresa,
      ...guia.value,
    };
    const entrega = await this.entrega.execute({ cliente, comunicacao, agora });
    if (!entrega.ok) return falha(`${cliente.empresa}: ${entrega.error.message}`);
    return { enviado: entrega.value.entregues > 0, ocorrencias: entrega.value.ocorrencias };
  }

  private async levantarAlertas(
    cliente: ClienteParaParcelamento,
    ocorrencias: OcorrenciaDeEntrega[],
  ) {
    let gravados = 0;
    let naoGravados = 0;
    for (const [tipo, mensagens] of agruparPorTipo(ocorrencias)) {
      const gravado = await this.alertas.alertar({
        setor: "simples_nacional",
        tipo,
        clienteId: cliente.clienteId,
        mensagem: mensagens.join(" | "),
      });
      if (gravado.ok) gravados += 1;
      else naoGravados += 1;
    }
    return { gravados, naoGravados };
  }
}

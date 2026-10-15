import {
  temDestinatario,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { EntregarComunicacaoPorCanaisPort } from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type {
  EnvioGuiaParcelamentoExecutado,
  ExecutarEnvioGuiaParcelamentoPort,
} from "@/modules/atendimento/application/ports/in/executar-envio-guia-parcelamento.provider";
import type { ObterGuiaParcelamentoParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-parcelamento-para-envio.provider";
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaParcelamento,
  ClientesParaParcelamentoPort,
} from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import {
  entregarReivindicando,
  falha,
  levantarAlertas,
  resolverAlertasDaRodada,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/use-cases/alertas-da-rodada";
import type { AppError } from "@/shared/errors/app.error";
import { diaDoMes } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [20, 22, 24, 26, 28];

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
      const gravacao = await levantarAlertas(this.alertas, cliente.clienteId, feito.ocorrencias);
      resumo.alertas += gravacao.gravados;
      alertasNaoGravados += gravacao.naoGravados;
    }
    resumo.falhas += alertasNaoGravados;

    resumo.falhas += await resolverAlertasDaRodada(this.alertas, agora, alertasNaoGravados);
    return ok(resumo);
  }

  private async enviar(cliente: ClienteParaParcelamento, agora: Date): Promise<Andamento> {
    if (!temDestinatario(cliente)) return semDestinatario(cliente.empresa);
    return entregarReivindicando(
      {
        reivindicar: () => this.clientes.reivindicar(cliente.clienteId),
        entregar: () => this.entregarGuia(cliente, agora),
        desfazer: () => this.clientes.desfazer(cliente.clienteId),
      },
      "Parcelamento",
      cliente.empresa,
      "pendente",
    );
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
}

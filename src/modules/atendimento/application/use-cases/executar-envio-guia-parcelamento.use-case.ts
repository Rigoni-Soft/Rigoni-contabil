import {
  entregarComReserva,
  executarRodada,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import type { EnviarGuiasParcelamentoPort } from "@/modules/atendimento/application/ports/in/enviar-guias-parcelamento.provider";
import type {
  EnvioGuiaParcelamentoExecutado,
  ExecutarEnvioGuiaParcelamentoPort,
} from "@/modules/atendimento/application/ports/in/executar-envio-guia-parcelamento.provider";
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteParaParcelamento,
  ClientesParaParcelamentoPort,
} from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { DIAS_DO_JOB_PARCELAMENTO } from "@/shared/kernel/dias-do-job-parcelamento";
import { temDestinatario } from "@/shared/kernel/forma-envio";
import { diaDoMes } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

// Job dos dias 20/22/24/26/28 (fuso de São Paulo): reserva o Cliente com parcelamento pendente e
// delega a entrega das guias ao núcleo `EnviarGuiasParcelamento`; a reserva é liberada se nada foi
// aceito e a rodada seguinte tenta de novo (`entregarComReserva`). Cada Cliente é independente.
export class ExecutarEnvioGuiaParcelamento implements ExecutarEnvioGuiaParcelamentoPort {
  constructor(
    private readonly clientes: ClientesParaParcelamentoPort,
    private readonly guiasDoCliente: EnviarGuiasParcelamentoPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<EnvioGuiaParcelamentoExecutado, AppError>> {
    const agora = this.relogio.agora();
    const resumo: EnvioGuiaParcelamentoExecutado = {
      executado: DIAS_DO_JOB_PARCELAMENTO.includes(diaDoMes(agora)),
      enviados: 0,
      alertas: 0,
      falhas: 0,
    };
    if (!resumo.executado) return ok(resumo);

    const clientes = await this.clientes.listarPendentes();
    if (!clientes.ok) return clientes;

    const rodada = await executarRodada(this.alertas, agora, clientes.value, async (cliente) => [
      await this.enviar(cliente, agora),
    ]);
    return ok({
      ...resumo,
      enviados: rodada.andamentos.filter(([andamento]) => andamento.enviado).length,
      alertas: rodada.alertas,
      falhas: rodada.falhas,
    });
  }

  private async enviar(cliente: ClienteParaParcelamento, agora: Date): Promise<Andamento> {
    if (!temDestinatario(cliente)) return semDestinatario(cliente.empresa);
    return entregarComReserva({
      descricao: `Parcelamento de ${cliente.empresa}`,
      reservar: () => this.clientes.reservar(cliente.clienteId),
      entregar: () => this.guiasDoCliente.execute({ cliente, agora }),
      concluir: (token) => this.clientes.concluir(cliente.clienteId, token),
      liberar: (token) => this.clientes.liberar(cliente.clienteId, token),
    });
  }
}

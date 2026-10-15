import {
  entregarComReserva,
  executarRodada,
  falha,
  paraAndamento,
  semDestinatario,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
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
import type { AppError } from "@/shared/errors/app.error";
import { temDestinatario } from "@/shared/kernel/forma-envio";
import { diaDoMes } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const DIAS_DO_JOB = [20, 22, 24, 26, 28];

// Job dos dias 20/22/24/26/28 (fuso de São Paulo): envia a guia de parcelamento pela forma de
// envio do Cliente que tem Parcelamento pendente e o marca como enviado. Falha do provedor fiscal
// ou do envio repete (nas portas) antes de alertar o setor Simples Nacional, e o Parcelamento
// segue pendente: a próxima rodada tenta de novo. A entrega é reservada (token, com validade) antes
// de sair e o Parcelamento só vira enviado ao concluir, depois do aceite: execuções simultâneas ou
// o Funcionário não geram envio em dobro, e uma queda no meio o deixa pendente (a reserva expira e
// a rodada seguinte retoma). Se o aceite ocorreu e a queda veio antes da conclusão, a guia pode
// ser reenviada (pelo menos uma vez). Cada Cliente é independente.
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
      entregar: () => this.entregarGuia(cliente, agora),
      concluir: (token) => this.clientes.concluir(cliente.clienteId, token),
      liberar: (token) => this.clientes.liberar(cliente.clienteId, token),
    });
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
    return paraAndamento(
      await this.entrega.execute({ cliente, comunicacao, agora }),
      cliente.empresa,
    );
  }
}

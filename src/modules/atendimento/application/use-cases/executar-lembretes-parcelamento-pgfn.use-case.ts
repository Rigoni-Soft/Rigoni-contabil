import {
  executarRodada,
  SEM_ANDAMENTO,
  type Andamento,
} from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import type {
  ExecutarLembretesParcelamentoPgfnPort,
  LembretesParcelamentoPgfnExecutados,
} from "@/modules/atendimento/application/ports/in/executar-lembretes-parcelamento-pgfn.provider";
import type { AlertaSetorPort } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type {
  ClienteComParcelamentoPgfn,
  ClientesComParcelamentoPgfnPort,
  EstadoDaGuiaPgfn,
} from "@/modules/atendimento/application/ports/out/clientes-com-parcelamento-pgfn.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { diaDoMes, mesAtual } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

// Fixos, também em fim de semana: o lembrete é para a equipe, não depende de dia útil.
const DIAS_DO_JOB = [1, 10, 15];

const ROTULO: Record<EstadoDaGuiaPgfn, string> = {
  sem_guia: "Falta anexar",
  a_confirmar: "A confirmar",
};

// "2026-10" -> "10/2026".
const competencia = (agora: Date) => mesAtual(agora).split("-").reverse().join("/");

function mensagem(cliente: ClienteComParcelamentoPgfn, agora: Date): string {
  const grupos = (Object.keys(ROTULO) as EstadoDaGuiaPgfn[])
    .map((estado) => ({
      estado,
      codigos: cliente.pendencias.filter((p) => p.estado === estado).map((p) => p.codigo),
    }))
    .filter(({ codigos }) => codigos.length > 0)
    .map(({ estado, codigos }) => `${ROTULO[estado]}: ${codigos.join(", ")}.`);
  return `${cliente.empresa}: Parcelamento PGFN sem guia confirmada de ${competencia(agora)}. ${grupos.join(" ")}`;
}

// Job dos dias 1/10/15 (fuso de São Paulo): alerta o setor Simples Nacional, um por Cliente, dos
// Parcelamentos PGFN sem guia confirmada da competência do mês. Competência atrasada não alerta. Não
// envia nada ao Cliente. O alerta é renovado a cada rodada e resolvido quando a guia confirmada do
// mês entra (o Cliente volta sem pendência) pelo mesmo mecanismo do job de lembretes.
export class ExecutarLembretesParcelamentoPgfn implements ExecutarLembretesParcelamentoPgfnPort {
  constructor(
    private readonly clientes: ClientesComParcelamentoPgfnPort,
    private readonly alertas: AlertaSetorPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<LembretesParcelamentoPgfnExecutados, AppError>> {
    const agora = this.relogio.agora();
    if (!DIAS_DO_JOB.includes(diaDoMes(agora))) {
      return ok({ executado: false, alertas: 0, falhas: 0 });
    }

    const clientes = await this.clientes.listar();
    if (!clientes.ok) return clientes;

    const rodada = await executarRodada(
      this.alertas,
      agora,
      clientes.value,
      async (cliente): Promise<Andamento[]> =>
        cliente.pendencias.length === 0
          ? [SEM_ANDAMENTO]
          : [
              {
                enviado: false,
                ocorrencias: [{ tipo: "guia_pgfn_pendente", mensagem: mensagem(cliente, agora) }],
              },
            ],
    );
    return ok({ executado: true, alertas: rodada.alertas, falhas: rodada.falhas });
  }
}

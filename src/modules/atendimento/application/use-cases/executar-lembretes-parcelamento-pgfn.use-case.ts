import {
  comOcorrencia,
  executarRodada,
  noSetor,
  SEM_ANDAMENTO,
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
  PendenciaPgfn,
} from "@/modules/atendimento/application/ports/out/clientes-com-parcelamento-pgfn.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { diaDoMes, mesAtual } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Fixos, também em fim de semana: o lembrete é para a equipe, não depende de dia útil.
const DIAS_DO_JOB = [1, 10, 15];

// "2026-10" -> "10/2026".
const competencia = (agora: Date) => mesAtual(agora).split("-").reverse().join("/");

function mensagem(
  cliente: ClienteComParcelamentoPgfn,
  pendencias: PendenciaPgfn[],
  agora: Date,
): string {
  const codigos = (estado: EstadoDaGuiaPgfn) =>
    pendencias
      .filter((p) => p.estado === estado)
      .map((p) => p.codigo)
      .join(", ");
  const faltam = codigos("sem_guia");
  const aConfirmar = codigos("a_confirmar");
  const grupos = [
    faltam && `Falta anexar: ${faltam}.`,
    aConfirmar && `A confirmar: ${aConfirmar}.`,
  ];
  return `${cliente.empresa}: Parcelamento PGFN sem guia confirmada de ${competencia(agora)}. ${grupos.filter(Boolean).join(" ")}`;
}

// As pendências agrupadas pelo Setor dono do Parcelamento.
function porSetor(pendencias: PendenciaPgfn[]): Map<SetorSlug, PendenciaPgfn[]> {
  const grupos = new Map<SetorSlug, PendenciaPgfn[]>();
  for (const p of pendencias) grupos.set(p.setor, [...(grupos.get(p.setor) ?? []), p]);
  return grupos;
}

// Job dos dias 1/10/15 (fuso de São Paulo): alerta o Setor dono do Parcelamento, um por Cliente e
// Setor, dos Parcelamentos PGFN sem guia confirmada da competência do mês. Competência atrasada não alerta. Não
// envia nada ao Cliente. O alerta é renovado a cada rodada e resolvido quando o Cliente volta
// sem pendência.
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

    const rodada = await executarRodada(this.alertas, agora, clientes.value, async (cliente) => {
      const doSetor = [...porSetor(cliente.pendencias)];
      if (doSetor.length === 0) return [SEM_ANDAMENTO];
      return doSetor.map(([setor, pendencias]) =>
        noSetor(comOcorrencia("guia_pgfn_pendente", mensagem(cliente, pendencias, agora)), setor),
      );
    });
    return ok({ executado: true, alertas: rodada.alertas, falhas: rodada.falhas });
  }
}

import type { NovoAtendimento } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AberturaAtendimento = Omit<NovoAtendimento, "funcionarioId">;

// `funcionarioId` null = nenhum Funcionário livre no Setor (a Fila é do #45).
export type AtendimentoAberto = { id: string; funcionarioId: string | null };

export interface AbrirAtendimentoPort {
  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>>;
}

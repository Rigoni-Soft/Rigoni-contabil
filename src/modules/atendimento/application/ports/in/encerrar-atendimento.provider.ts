import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `proximoDaFila`: o Atendimento que o Funcionário liberado assumiu da Fila, se havia.
export type AtendimentoEncerrado = { proximoDaFila: string | null };

export interface EncerrarAtendimentoPort {
  execute(input: { atendimentoId: string }): Promise<Result<AtendimentoEncerrado, AppError>>;
}

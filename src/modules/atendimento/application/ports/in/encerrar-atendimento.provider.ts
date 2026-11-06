import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface EncerrarAtendimentoPort {
  execute(input: { atendimentoId: string }): Promise<Result<void, AppError>>;
}

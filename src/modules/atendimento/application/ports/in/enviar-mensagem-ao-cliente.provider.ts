import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface EnviarMensagemAoClientePort {
  execute(input: { atendimentoId: string; texto: string }): Promise<Result<void, AppError>>;
}

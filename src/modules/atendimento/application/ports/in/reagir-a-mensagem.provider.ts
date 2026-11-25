import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ReagirAMensagemPort {
  execute(input: {
    atendimentoId: string;
    mensagemId: string;
    emoji: string;
  }): Promise<Result<void, AppError>>;
}

import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ContarAvisosNaoVistosPort {
  execute(): Promise<Result<number, AppError>>;
}

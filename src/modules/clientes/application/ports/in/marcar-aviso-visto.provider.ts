import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface MarcarAvisoVistoPort {
  execute(avisoId: string): Promise<Result<void, AppError>>;
}

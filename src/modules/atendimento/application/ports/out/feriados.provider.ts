import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface FeriadosPort {
  listarDatas(): Promise<Result<string[], AppError>>;
}

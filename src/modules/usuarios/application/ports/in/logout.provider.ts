import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface LogoutPort {
  execute(): Promise<Result<void, AppError>>;
}

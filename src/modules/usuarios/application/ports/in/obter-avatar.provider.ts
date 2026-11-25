import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ObterAvatarPort {
  execute(): Promise<Result<Uint8Array, AppError>>;
}

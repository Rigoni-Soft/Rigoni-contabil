import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnviarAvatarInput = { bytes: Uint8Array };

export interface EnviarAvatarPort {
  execute(input: EnviarAvatarInput): Promise<Result<{ avatarAtualizadoEm: string }, AppError>>;
}

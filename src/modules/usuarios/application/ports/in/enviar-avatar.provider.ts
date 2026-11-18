import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnviarAvatarInput = { bytes: Uint8Array };

export interface EnviarAvatarPort {
  // Devolve o ISO da gravação (o `?v=` do avatar).
  execute(input: EnviarAvatarInput): Promise<Result<{ avatarAtualizadoEm: string }, AppError>>;
}

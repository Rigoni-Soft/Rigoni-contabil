import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TrocarSenhaInput = { novaSenha: string };

export interface TrocarSenhaPort {
  execute(input: TrocarSenhaInput): Promise<Result<void, AppError>>;
}

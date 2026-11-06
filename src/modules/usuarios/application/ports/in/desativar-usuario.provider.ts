import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DesativarUsuarioInput = { usuarioId: string };

export interface DesativarUsuarioPort {
  execute(input: DesativarUsuarioInput): Promise<Result<void, AppError>>;
}

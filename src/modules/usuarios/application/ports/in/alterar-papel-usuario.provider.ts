import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AlterarPapelUsuarioInput = { usuarioId: string; papel: string };

export interface AlterarPapelUsuarioPort {
  execute(input: AlterarPapelUsuarioInput): Promise<Result<void, AppError>>;
}

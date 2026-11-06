import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LoginInput = { email: string; senha: string };

export interface LoginPort {
  execute(input: LoginInput): Promise<Result<UsuarioDto, AppError>>;
}

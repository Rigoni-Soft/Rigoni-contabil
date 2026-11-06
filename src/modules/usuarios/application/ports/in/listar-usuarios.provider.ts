import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ListarUsuariosPort {
  execute(): Promise<Result<UsuarioDto[], AppError>>;
}

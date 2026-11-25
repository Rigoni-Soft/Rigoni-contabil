import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface AvatarMarcaPort {
  definir(usuarioId: UsuarioId, em: Date | null): Promise<Result<void, AppError>>;
}

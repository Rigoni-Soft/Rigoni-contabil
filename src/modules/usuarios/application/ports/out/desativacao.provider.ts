import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface DesativacaoPort {
  desativar(alvoId: UsuarioId, atorId: UsuarioId): Promise<Result<void, AppError>>;
  registrarBloqueio(alvoId: UsuarioId): Promise<Result<void, AppError>>;
}

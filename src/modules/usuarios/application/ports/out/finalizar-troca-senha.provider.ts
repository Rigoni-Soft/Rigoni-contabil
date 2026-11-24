import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface FinalizarTrocaSenhaPort {
  registrarAuthAlterado(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
  finalizar(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
}

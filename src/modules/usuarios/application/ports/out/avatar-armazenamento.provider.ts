import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface AvatarArmazenamentoPort {
  gravar(usuarioId: UsuarioId, bytes: Uint8Array): Promise<Result<void, AppError>>;
  apagar(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
  ler(usuarioId: UsuarioId): Promise<Result<Uint8Array | null, AppError>>;
}

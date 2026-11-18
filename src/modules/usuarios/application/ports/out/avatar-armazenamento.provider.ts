import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Storage privado do avatar (ADR 0012): um objeto por usuário, sobrescrito. Fronteira server-side
// privilegiada; a autorização é do caso de uso.
export interface AvatarArmazenamentoPort {
  gravar(usuarioId: UsuarioId, bytes: Uint8Array): Promise<Result<void, AppError>>;
  // Idempotente: apagar o que não existe é sucesso.
  apagar(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
  // null = não há objeto.
  ler(usuarioId: UsuarioId): Promise<Result<Uint8Array | null, AppError>>;
}

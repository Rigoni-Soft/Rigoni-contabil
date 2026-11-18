import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `perfis.avatar_atualizado_em` (null = sem foto): só o servidor grava (gatilho do banco, ADR 0008).
export interface AvatarMarcaPort {
  definir(usuarioId: UsuarioId, em: Date | null): Promise<Result<void, AppError>>;
}

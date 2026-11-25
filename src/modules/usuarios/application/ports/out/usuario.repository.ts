import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface UsuarioRepository {
  buscarPorId(id: UsuarioId): Promise<Result<Usuario | null, AppError>>;
  criar(usuario: Usuario): Promise<Result<void, AppError>>;
  listarAtivos(): Promise<Result<Usuario[], AppError>>;
  listarComDesativacaoPendente(): Promise<Result<Usuario[], AppError>>;
  buscarLiderAtivoDoSetor(setor: Setor): Promise<Result<Usuario | null, AppError>>;
}

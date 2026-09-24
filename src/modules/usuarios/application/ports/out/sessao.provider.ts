import type { Result } from "@/shared/kernel/result";
import type { AppError } from "@/shared/errors/app.error";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

export interface SessaoPort {
  autenticar(email: string, senha: string): Promise<Result<void, AppError>>;
  encerrar(): Promise<void>;
  usuarioAtualId(): Promise<UsuarioId | null>;
}

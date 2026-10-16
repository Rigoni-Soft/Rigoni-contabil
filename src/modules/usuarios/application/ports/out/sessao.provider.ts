import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface SessaoPort {
  autenticar(email: string, senha: string): Promise<Result<void, AppError>>;
  encerrar(): Promise<Result<void, AppError>>;
  usuarioAtualId(): Promise<UsuarioId | null>;
  trocarSenha(novaSenha: string): Promise<Result<void, AppError>>;
}

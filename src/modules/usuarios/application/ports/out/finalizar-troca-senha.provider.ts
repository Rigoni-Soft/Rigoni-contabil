import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Fronteira server-side privilegiada (ADR 0001, mesmo padrão de AuthAdminPort):
// marca a troca via client service_role, nunca pelo client autenticado do
// próprio usuário. Devolutiva técnica PR #62, ponto 2 — a RPC não aceita mais
// EXECUTE de `authenticated`, então só um client service_role consegue chamá-la.
export interface FinalizarTrocaSenhaPort {
  marcar(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
}

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Fronteira server-side privilegiada (ADR 0001, mesmo padrão de AuthAdminPort):
// todas as operações rodam via client service_role, nunca pelo client autenticado
// do próprio usuário (devolutiva técnica PR #62, ponto 2).
//
// Devolutiva PR #62 (retry): `registrarAuthAlterado` só é chamado depois de
// updateUser() ter sucesso (prova de que o Auth mudou); `finalizar` conclui
// perfil + auditoria numa única transação, idempotente (chamar de novo depois
// de concluída não faz nada).
export interface FinalizarTrocaSenhaPort {
  registrarAuthAlterado(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
  finalizar(usuarioId: UsuarioId): Promise<Result<void, AppError>>;
}

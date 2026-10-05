import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Fronteira server-side privilegiada (ADR 0001, mesmo padrão de FinalizarTrocaSenhaPort):
// a RPC só aceita service_role. Marca o perfil como desativado e registra a
// auditoria na MESMA transação; idempotente (já desativado = não faz nada).
export interface DesativacaoPort {
  desativar(alvoId: UsuarioId, atorId: UsuarioId): Promise<Result<void, AppError>>;
}

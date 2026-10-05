import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Fronteira server-side privilegiada (ADR 0001, mesmo padrão de DesativacaoPort):
// a RPC só aceita service_role. Troca o papel e registra a auditoria na MESMA
// transação; idempotente (já no papel pedido = não faz nada). Se o Setor já tem
// Líder ativo (corrida com outra promoção), devolve ValidationError.
export interface AlteracaoPapelPort {
  alterar(
    alvoId: UsuarioId,
    atorId: UsuarioId,
    papel: "lider_setor" | "funcionario",
  ): Promise<Result<void, AppError>>;
}

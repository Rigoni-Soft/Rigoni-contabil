import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type PapelAlteravel = "lider_setor" | "funcionario";

// Orientação única da regra de um Líder ativo por Setor (use-case e gateway).
export const ORIENTACAO_SETOR_COM_LIDER = "Rebaixe-o a Funcionário antes de promover outro.";

// Fronteira server-side privilegiada (ADR 0001, mesmo padrão de DesativacaoPort):
// a RPC só aceita service_role. Troca o papel e registra a auditoria na MESMA
// transação; idempotente (já no papel pedido = não faz nada). Se o Setor já tem
// Líder ativo (corrida com outra promoção), devolve ValidationError.
export interface AlteracaoPapelPort {
  alterar(
    alvoId: UsuarioId,
    atorId: UsuarioId,
    papel: PapelAlteravel,
  ): Promise<Result<void, AppError>>;
}

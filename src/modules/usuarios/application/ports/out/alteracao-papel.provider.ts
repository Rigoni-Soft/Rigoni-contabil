import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type PapelAlteravel = "lider_setor" | "funcionario";

export const ORIENTACAO_SETOR_COM_LIDER = "Rebaixe-o a Funcionário antes de promover outro.";

export interface AlteracaoPapelPort {
  alterar(
    alvoId: UsuarioId,
    atorId: UsuarioId,
    papel: PapelAlteravel,
  ): Promise<Result<void, AppError>>;
}

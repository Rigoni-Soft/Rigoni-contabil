import { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { PerfilRowDto } from "@/modules/usuarios/infra/dtos/perfil-row.dto";
import type { ValidationError } from "@/shared/errors/validation.error";
import type { Result } from "@/shared/kernel/result";

export function perfilParaUsuario(row: PerfilRowDto): Result<Usuario, ValidationError> {
  return Usuario.builder()
    .restaurar({
      ...row,
      senhaTrocadaEm: row.senha_trocada_em,
      senhaProvisoriaExpiraEm: row.senha_provisoria_expira_em,
    })
    .build();
}

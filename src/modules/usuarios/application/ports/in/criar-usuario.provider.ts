import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { PapelCadastravel } from "@/shared/kernel/papeis";
import type { Result } from "@/shared/kernel/result";

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  papel: PapelCadastravel;
  setor: string;
};

export type CriarUsuarioOutput = {
  usuario: UsuarioDto;
  senhaProvisoria: string;
};

export interface CriarUsuarioPort {
  execute(input: CriarUsuarioInput): Promise<Result<CriarUsuarioOutput, AppError>>;
}

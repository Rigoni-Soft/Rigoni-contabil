import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  papel: "lider_setor" | "funcionario";
  setor: string;
};

export type CriarUsuarioOutput = {
  usuario: UsuarioDto;
  senhaProvisoria: string;
};

export interface CriarUsuarioPort {
  execute(input: CriarUsuarioInput): Promise<Result<CriarUsuarioOutput, AppError>>;
}

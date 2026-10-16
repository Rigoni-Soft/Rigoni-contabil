import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";

export interface ObterSessaoPort {
  execute(): Promise<UsuarioDto | null>;
}

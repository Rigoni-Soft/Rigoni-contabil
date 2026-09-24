import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { ObterSessaoPort } from "@/modules/usuarios/application/ports/in/obter-sessao.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";

export class ObterSessao implements ObterSessaoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async execute(): Promise<UsuarioDto | null> {
    const id = await this.sessao.usuarioAtualId();
    if (!id) return null;

    const usuario = await this.usuarios.buscarPorId(id);
    return usuario ? usuarioParaDto(usuario) : null;
  }
}

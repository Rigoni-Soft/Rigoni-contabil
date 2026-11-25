import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type { ObterSessaoPort } from "@/modules/usuarios/application/ports/in/obter-sessao.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";

export class ObterSessao implements ObterSessaoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(): Promise<UsuarioDto | null> {
    const id = await this.sessao.usuarioAtualId();
    if (!id) return null;

    const perfil = await this.usuarios.buscarPorId(id);
    if (!perfil.ok) {
      this.erros.registrar("Falha ao carregar perfil da sessão:", perfil.error.message);
      return null;
    }
    if (!perfil.value) return null;

    if (perfil.value.senhaProvisoriaVencida(new Date())) return null;

    if (perfil.value.estaDesativado()) return null;

    return usuarioParaDto(perfil.value);
  }
}

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

    const perfil = await this.usuarios.buscarPorId(id);
    // Leitura best-effort da própria sessão: falha técnica também vira "sem sessão"
    // pra quem chama (mesmo contrato de hoje), mas fica registrada no log — antes
    // sumia dentro do `null` sem deixar rastro (devolutiva #55, ponto 02).
    if (!perfil.ok) {
      console.error("Falha ao carregar perfil da sessão:", perfil.error.message);
      return null;
    }
    return perfil.value ? usuarioParaDto(perfil.value) : null;
  }
}

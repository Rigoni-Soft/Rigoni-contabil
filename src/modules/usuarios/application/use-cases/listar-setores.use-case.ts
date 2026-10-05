import type {
  ListarSetoresPort,
  SetorDto,
} from "@/modules/usuarios/application/ports/in/listar-setores.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AutorizacaoService } from "@/modules/usuarios/domain/services/autorizacao.service";
import { Setor, SETORES } from "@/modules/usuarios/domain/value-objects/setor.vo";

export class ListarSetores implements ListarSetoresPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly autorizacao: AutorizacaoService,
  ) {}

  async execute(): Promise<SetorDto[]> {
    const id = await this.sessao.usuarioAtualId();
    if (!id) return [];

    const perfil = await this.usuarios.buscarPorId(id);
    if (!perfil.ok) {
      console.error("Falha ao carregar perfil para listar setores:", perfil.error.message);
      return [];
    }
    // #58: JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade.
    if (!perfil.value || perfil.value.estaDesativado()) return [];
    const usuario = perfil.value;

    return SETORES.filter((slug) => {
      const setor = Setor.criar(slug);
      return setor.ok && this.autorizacao.podeAcessarSetor(usuario, setor.value);
    }).map((slug) => ({ slug }));
  }
}

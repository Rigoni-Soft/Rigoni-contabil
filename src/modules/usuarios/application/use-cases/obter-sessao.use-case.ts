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
    if (!perfil.value) return null;

    // Devolutiva técnica PR #62, ponto 3: Login.execute() já bloqueia entrada
    // com senha provisória vencida, mas uma sessão aberta ANTES do vencimento
    // seguia válida depois dele — só a troca obrigatória (precisaTrocarSenha)
    // era checada por página, nunca o vencimento em si. Toda página autenticada
    // passa por carregarSessao() → aqui, então tratar como "sem sessão" fecha
    // esse caminho sem precisar duplicar a checagem em cada rota.
    if (perfil.value.senhaProvisoriaVencida(new Date())) return null;

    // #58: sessão aberta antes da desativação para de valer na próxima página.
    if (perfil.value.estaDesativado()) return null;

    return usuarioParaDto(perfil.value);
  }
}

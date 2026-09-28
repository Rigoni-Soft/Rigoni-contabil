import type {
  TrocarSenhaInput,
  TrocarSenhaPort,
} from "@/modules/usuarios/application/ports/in/trocar-senha.provider";
import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class TrocarSenha implements TrocarSenhaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({ novaSenha }: TrocarSenhaInput): Promise<Result<void, AppError>> {
    const id = await this.sessao.usuarioAtualId();
    if (!id) return err(new ForbiddenError("Sessão inválida."));

    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) return err(new ForbiddenError("Usuário autenticado sem perfil cadastrado."));

    // Decide antes de marcar a troca, senão precisaTrocarSenha() já viraria false.
    const primeiroAcesso = usuario.precisaTrocarSenha();

    const trocada = await this.sessao.trocarSenha(novaSenha);
    if (!trocada.ok) return trocada;

    const marcado = await this.usuarios.marcarSenhaTrocada();
    if (!marcado.ok) return marcado;

    await this.auditoria.registrar({
      ator: id,
      setor: usuario.setor.slug,
      acao: primeiroAcesso ? "usuario.trocar_senha_primeiro_acesso" : "usuario.trocar_senha",
      alvo: usuario.email,
      resultado: "sucesso",
    });

    return ok(undefined);
  }
}

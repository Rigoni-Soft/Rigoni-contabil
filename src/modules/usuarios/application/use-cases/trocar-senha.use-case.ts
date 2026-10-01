import type {
  TrocarSenhaInput,
  TrocarSenhaPort,
} from "@/modules/usuarios/application/ports/in/trocar-senha.provider";
import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { FinalizarTrocaSenhaPort } from "@/modules/usuarios/application/ports/out/finalizar-troca-senha.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class TrocarSenha implements TrocarSenhaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly finalizarTrocaSenha: FinalizarTrocaSenhaPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({ novaSenha }: TrocarSenhaInput): Promise<Result<void, AppError>> {
    const id = await this.sessao.usuarioAtualId();
    if (!id) return err(new ForbiddenError("Sessão inválida."));

    const perfil = await this.usuarios.buscarPorId(id);
    // Erro técnico não vira "sem perfil cadastrado" (devolutiva #55, ponto 02):
    // propaga o AppError original em vez de mascará-lo.
    if (!perfil.ok) return perfil;
    if (!perfil.value) return err(new ForbiddenError("Usuário autenticado sem perfil cadastrado."));
    const usuario = perfil.value;

    // Decide antes de marcar a troca, senão precisaTrocarSenha() já viraria false.
    const primeiroAcesso = usuario.precisaTrocarSenha();

    const trocada = await this.sessao.trocarSenha(novaSenha);
    if (!trocada.ok) return trocada;

    // A partir daqui a senha já mudou de verdade no Auth — diferente do fluxo
    // de CriarUsuario (devolutiva PR #61), não existe compensação possível: a
    // aplicação não guarda a credencial anterior pra "desfazer" (ADR 0002).
    // Qualquer falha a partir daqui vira EstadoInconsistenteError em vez de
    // sucesso silencioso (devolutiva técnica PR #62, pontos 4 e 5) — e é
    // reconciliável reenviando o mesmo formulário, já logado: marcar() é um
    // UPDATE idempotente, e o registro de auditoria não tem efeito colateral
    // pra repetir.
    const marcado = await this.finalizarTrocaSenha.marcar(id);
    if (!marcado.ok) {
      console.error(
        "Falha ao finalizar troca de senha (senha já alterada no Auth):",
        marcado.error.message,
      );
      return err(
        new EstadoInconsistenteError(
          "Sua senha foi alterada, mas houve uma falha ao concluir. Tente novamente — a senha " +
            "nova já vale pra entrar.",
          id,
        ),
      );
    }

    const auditoria = await this.auditoria.registrar({
      ator: id,
      setor: usuario.setor.slug,
      acao: primeiroAcesso ? "usuario.trocar_senha_primeiro_acesso" : "usuario.trocar_senha",
      alvo: usuario.email,
      resultado: "sucesso",
    });
    if (!auditoria.ok) {
      console.error(
        "Falha ao registrar auditoria da troca de senha (senha já alterada):",
        auditoria.error.message,
      );
      return err(
        new EstadoInconsistenteError(
          "Sua senha foi alterada, mas a auditoria da ação falhou. Procedimento reconciliável " +
            "pelo Admin.",
          id,
        ),
      );
    }

    return ok(undefined);
  }
}

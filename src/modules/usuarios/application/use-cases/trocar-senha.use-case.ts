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
import { ValidationError } from "@/shared/errors/validation.error";
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
    if (!trocada.ok) {
      // Devolutiva técnica PR #62, ponto 1: "same_password" só é reenvio
      // legítimo (updateUser() já teve sucesso numa tentativa anterior cuja
      // finalização falhou) quando o perfil JÁ NÃO está mais em primeiro
      // acesso — nesse caso a troca real nunca teria rodado antes, e
      // "same_password" só pode significar que o usuário mandou a própria
      // senha provisória (ainda vigente) como "nova senha".
      if (trocada.error.code !== "SENHA_JA_DEFINIDA" || primeiroAcesso) {
        return trocada.error.code === "SENHA_JA_DEFINIDA"
          ? err(
              new ValidationError("A nova senha não pode ser igual à senha atual.", {
                novaSenha: ["não pode repetir a senha provisória atual"],
              }),
            )
          : trocada;
      }
    }

    // A partir daqui a senha já mudou de verdade no Auth (ou já tinha mudado
    // numa tentativa anterior) — diferente do fluxo de CriarUsuario
    // (devolutiva PR #61), não existe compensação possível: a aplicação não
    // guarda a credencial anterior pra "desfazer" (ADR 0002). Qualquer falha a
    // partir daqui vira EstadoInconsistenteError em vez de sucesso silencioso
    // (devolutiva técnica PR #62, pontos 4 e 5).
    //
    // Devolutiva técnica PR #62, ponto 2: a auditoria roda ANTES de marcar() —
    // de propósito. `acao` é decidido a partir de `primeiroAcesso`, lido do
    // perfil antes de qualquer escrita; se marcar() rodasse primeiro e
    // falhasse só a auditoria, o retry recalcularia precisaTrocarSenha() já
    // como false (marcar já tinha sucedido) e trocaria o evento original
    // (usuario.trocar_senha_primeiro_acesso) por usuario.trocar_senha. Nessa
    // ordem, enquanto marcar() não suceder, todo retry recalcula o mesmo
    // `primeiroAcesso` de antes — preservando o evento original.
    // ponytail: se marcar() falhar depois da auditoria já ter sido escrita, o
    // retry registra a auditoria de novo (duplicata) — UPDATE idempotente em
    // perfis cobre marcar(), auditoria não. Aceitável: marcar() é um UPDATE
    // local trivial, bem menos provável de falhar que a chamada ao Auth. Se
    // isso se mostrar um problema real, mover marcar()+auditoria pra uma RPC
    // única (transação atômica) remove a janela.
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
          "Sua senha foi alterada, mas a auditoria da ação falhou. Tente novamente.",
          id,
        ),
      );
    }

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

    return ok(undefined);
  }
}

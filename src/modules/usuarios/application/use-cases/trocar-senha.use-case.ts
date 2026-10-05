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
    // #58: JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade.
    if (usuario.estaDesativado()) return err(new ForbiddenError("Conta desativada."));

    // Decide antes de qualquer escrita, senão precisaTrocarSenha() já viraria false.
    const primeiroAcesso = usuario.precisaTrocarSenha();
    // Devolutiva PR #62 (retry): o marcador só é gravado DEPOIS de updateUser()
    // ter sucesso — prova que o Auth já tem a senha nova. Com ele, o estado
    // pendente é só perfil + auditoria e o retry pula o Auth por completo.
    const authJaAlterado = primeiroAcesso && usuario.authJaAlterado();

    if (!authJaAlterado) {
      const trocada = await this.sessao.trocarSenha(novaSenha);
      if (!trocada.ok) {
        const senhaJaDefinida = trocada.error.code === "SENHA_JA_DEFINIDA";
        // Fora do primeiro acesso, same_password é reenvio legítimo (a auditoria
        // é o último passo e nada ficou gravado). Em primeiro acesso, sem prova
        // de Auth alterado, só pode ser o usuário reenviando a senha provisória.
        if (!senhaJaDefinida || primeiroAcesso) {
          return senhaJaDefinida
            ? err(
                new ValidationError("A nova senha não pode ser igual à senha atual.", {
                  novaSenha: ["não pode repetir a senha provisória atual"],
                }),
              )
            : trocada;
        }
      }

      if (primeiroAcesso) {
        // Best-effort: se falhar, finalizar() abaixo ainda tenta concluir; se
        // ambos falharem o retry cai em same_password e é recusado (seguro —
        // nunca finaliza sem prova), pedindo outra senha.
        const registrada = await this.finalizarTrocaSenha.registrarAuthAlterado(id);
        if (!registrada.ok) {
          console.error("Falha ao registrar prova de Auth alterado:", registrada.error.message);
        }
      }
    }

    // A partir daqui a senha já mudou no Auth — não existe compensação possível:
    // a aplicação não guarda a credencial anterior pra "desfazer" (ADR 0002).
    // Falha daqui em diante vira EstadoInconsistenteError, recuperável por retry.
    if (primeiroAcesso) {
      // Perfil + auditoria numa única transação idempotente (migration
      // 20261001090000): retry conclui só o que falta, sem nova troca no Auth e
      // sem auditoria duplicada.
      const finalizada = await this.finalizarTrocaSenha.finalizar(id);
      if (!finalizada.ok) {
        console.error(
          "Falha ao finalizar troca de senha (senha já alterada no Auth):",
          finalizada.error.message,
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

    // Troca voluntária: sem perfil a finalizar, a auditoria é o último passo —
    // se falhar, nada foi escrito e o retry (same_password tolerado) registra 1x.
    const auditoria = await this.auditoria.registrar({
      ator: id,
      setor: usuario.setor.slug,
      acao: "usuario.trocar_senha",
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

    return ok(undefined);
  }
}

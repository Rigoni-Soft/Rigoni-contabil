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

    // Decide antes de qualquer escrita, senão precisaTrocarSenha() já viraria false.
    const primeiroAcesso = usuario.precisaTrocarSenha();
    // Devolutiva técnica PR #62 (retry): marcador gravado numa tentativa anterior
    // = o Auth pode já ter a senha nova, só a finalização ficou pendente.
    const retomada = usuario.trocaSenhaPendente();

    if (primeiroAcesso && !retomada) {
      const iniciada = await this.finalizarTrocaSenha.iniciar(id);
      if (!iniciada.ok) return iniciada;
    }

    const trocada = await this.sessao.trocarSenha(novaSenha);
    if (!trocada.ok) {
      const senhaJaDefinida = trocada.error.code === "SENHA_JA_DEFINIDA";
      // "same_password" só é reenvio legítimo (updateUser() já teve sucesso numa
      // tentativa cuja finalização falhou) com marcador de tentativa anterior
      // (retomada) ou fora do primeiro acesso. Em primeiro acesso sem marcador,
      // só pode ser o usuário mandando a própria senha provisória.
      if (!senhaJaDefinida || (primeiroAcesso && !retomada)) {
        // Marcador desta chamada não vale mais: o Auth não mudou. Best-effort —
        // se falhar, o pior caso é um retry aceitar same_password sem troca real.
        if (primeiroAcesso && !retomada) await this.finalizarTrocaSenha.cancelar(id);
        return senhaJaDefinida
          ? err(
              new ValidationError("A nova senha não pode ser igual à senha atual.", {
                novaSenha: ["não pode repetir a senha provisória atual"],
              }),
            )
          : trocada;
      }
    }

    // A partir daqui a senha já mudou de verdade no Auth (ou já tinha mudado
    // numa tentativa anterior) — não existe compensação possível: a aplicação não
    // guarda a credencial anterior pra "desfazer" (ADR 0002). Falha daqui em
    // diante vira EstadoInconsistenteError, recuperável por retry.
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

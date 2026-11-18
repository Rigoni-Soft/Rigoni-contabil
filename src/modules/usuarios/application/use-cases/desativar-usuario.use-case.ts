import type {
  DesativarUsuarioInput,
  DesativarUsuarioPort,
} from "@/modules/usuarios/application/ports/in/desativar-usuario.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { AvatarMarcaPort } from "@/modules/usuarios/application/ports/out/avatar-marca.provider";
import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirAdmin } from "@/modules/usuarios/application/use-cases/exigir-admin.use-case";
import type { Usuario, UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class DesativarUsuario implements DesativarUsuarioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly desativacao: DesativacaoPort,
    private readonly authAdmin: AuthAdminPort,
    private readonly armazenamento: AvatarArmazenamentoPort,
    private readonly marca: AvatarMarcaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute({ usuarioId }: DesativarUsuarioInput): Promise<Result<void, AppError>> {
    const ator = await exigirAdmin(this.sessao, this.usuarios, "Só Admin desativa usuários.");
    if (!ator.ok) return ator;

    // Admin nunca é desativado pela UI (nem o próprio): só Líder/Funcionário.
    if (usuarioId === ator.value.id) {
      return err(new ForbiddenError("Você não pode desativar a própria conta."));
    }
    const alvo = await this.usuarios.buscarPorId(usuarioId as UsuarioId);
    if (!alvo.ok) return alvo;
    if (!alvo.value) return err(new ValidationError("Usuário não encontrado."));
    if (alvo.value.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Líder ou Funcionário podem ser desativados."));
    }

    // Marca + audita primeiro (transação única, idempotente): a partir daqui o app
    // já barra login e sessão. O ban no Auth e o apagar da foto vêm depois; repetir a ação
    // completa é seguro (refaz só o que falta, nada duplica).
    const desativado = await this.desativacao.desativar(alvo.value.id, ator.value.id);
    if (!desativado.ok) return desativado;

    // As duas etapas rodam sempre: a falha de uma não impede a outra (a foto é dado pessoal e não
    // espera um ban que falhou). O que falhar deixa a conta como "conclusão pendente" na lista.
    const pendencias: string[] = [];
    const bloqueio = await this.concluirBloqueio(alvo.value);
    if (!bloqueio.ok) pendencias.push("o bloqueio da conta falhou");
    const foto = await this.apagarFoto(alvo.value);
    if (!foto.ok) pendencias.push("a foto não foi apagada");
    if (pendencias.length === 0) return ok(undefined);

    // O usuário JÁ está desativado e auditado (a RLS já nega o acesso); só uma etapa de conclusão
    // falhou. Não apresenta isso como falha total (mesmo padrão do EstadoInconsistenteError).
    return err(
      new EstadoInconsistenteError(
        `Usuário desativado, mas ${pendencias.join(" e ")}. Ele segue na lista como conclusão pendente: repita a desativação por lá.`,
        alvo.value.id,
      ),
    );
  }

  // `banido_em` registra a confirmação do Auth: com ela a etapa já está feita e não se repete.
  private async concluirBloqueio(alvo: Usuario): Promise<Result<void, AppError>> {
    if (alvo.bloqueioConfirmado()) return ok(undefined);
    const banido = await this.authAdmin.banirConta(alvo.id);
    const registrado = banido.ok ? await this.desativacao.registrarBloqueio(alvo.id) : banido;
    if (!registrado.ok) {
      this.erros.registrar(
        `Falha ao bloquear conta desativada (id=${alvo.id}):`,
        registrado.error.message,
      );
    }
    return registrado;
  }

  // O objeto sai antes de a coluna ser zerada: se apagar falhar a coluna continua preenchida, que é
  // o marcador da pendência (ADR 0012).
  private async apagarFoto(alvo: Usuario): Promise<Result<void, AppError>> {
    if (!alvo.temAvatar()) return ok(undefined);
    const apagada = await this.armazenamento.apagar(alvo.id);
    const zerada = apagada.ok ? await this.marca.definir(alvo.id, null) : apagada;
    if (!zerada.ok) {
      this.erros.registrar(
        `Falha ao apagar a foto do usuário desativado (id=${alvo.id}):`,
        zerada.error.message,
      );
    }
    return zerada;
  }
}

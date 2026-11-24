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

    if (usuarioId === ator.value.id) {
      return err(new ForbiddenError("Você não pode desativar a própria conta."));
    }
    const alvo = await this.usuarios.buscarPorId(usuarioId as UsuarioId);
    if (!alvo.ok) return alvo;
    if (!alvo.value) return err(new ValidationError("Usuário não encontrado."));
    if (alvo.value.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Líder ou Funcionário podem ser desativados."));
    }

    const desativado = await this.desativacao.desativar(alvo.value.id, ator.value.id);
    if (!desativado.ok) return desativado;

    const pendencias: string[] = [];
    const bloqueio = await this.concluirBloqueio(alvo.value);
    if (!bloqueio.ok) pendencias.push("o bloqueio da conta falhou");
    const foto = await this.apagarFoto(alvo.value);
    if (!foto.ok) pendencias.push("a foto não foi apagada");
    if (pendencias.length === 0) return ok(undefined);

    return err(
      new EstadoInconsistenteError(
        `Usuário desativado, mas ${pendencias.join(" e ")}. Ele segue na lista como conclusão pendente: repita a desativação por lá.`,
        alvo.value.id,
      ),
    );
  }

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

  private async apagarFoto(alvo: Usuario): Promise<Result<void, AppError>> {
    const apagada = await this.armazenamento.apagar(alvo.id);
    if (apagada.ok && !alvo.temAvatar()) return apagada;
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

import type {
  DesativarUsuarioInput,
  DesativarUsuarioPort,
} from "@/modules/usuarios/application/ports/in/desativar-usuario.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

export class DesativarUsuario implements DesativarUsuarioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly desativacao: DesativacaoPort,
    private readonly authAdmin: AuthAdminPort,
  ) {}

  async execute({ usuarioId }: DesativarUsuarioInput): Promise<Result<void, AppError>> {
    const atorId = await this.sessao.usuarioAtualId();
    if (!atorId) return err(new ForbiddenError("Sessão inválida."));

    const perfilAtor = await this.usuarios.buscarPorId(atorId);
    if (!perfilAtor.ok) return perfilAtor;
    if (!perfilAtor.value?.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Admin desativa usuários."));
    }

    // Admin nunca é desativado pela UI (nem o próprio): só Líder/Funcionário (#58).
    if (usuarioId === atorId) {
      return err(new ForbiddenError("Você não pode desativar a própria conta."));
    }
    const alvo = await this.usuarios.buscarPorId(usuarioId as UsuarioId);
    if (!alvo.ok) return alvo;
    if (!alvo.value) return err(new ValidationError("Usuário não encontrado."));
    if (alvo.value.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Líder ou Funcionário podem ser desativados."));
    }

    // Marca + audita primeiro (transação única, idempotente): a partir daqui o app
    // já barra login e sessão. O ban no Auth vem depois e fecha também o refresh de
    // token; se falhar, repetir a ação completa é seguro (nada duplica).
    const desativado = await this.desativacao.desativar(alvo.value.id, atorId);
    if (!desativado.ok) return desativado;

    return this.authAdmin.banirConta(alvo.value.id);
  }
}

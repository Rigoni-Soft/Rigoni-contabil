import type {
  DesativarUsuarioInput,
  DesativarUsuarioPort,
} from "@/modules/usuarios/application/ports/in/desativar-usuario.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { exigirAdmin } from "@/modules/usuarios/application/use-cases/exigir-admin.use-case";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
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
    // já barra login e sessão. O ban no Auth vem depois e fecha também o refresh de
    // token; repetir a ação completa é seguro (nada duplica).
    const desativado = await this.desativacao.desativar(alvo.value.id, ator.value.id);
    if (!desativado.ok) return desativado;

    // `banido_em` registra a confirmação do Auth: sem ela a conta aparece na lista
    // como "bloqueio pendente" e o Admin repete este mesmo caso de uso (idempotente).
    const banido = await this.authAdmin.banirConta(alvo.value.id);
    const registrado = banido.ok ? await this.desativacao.registrarBloqueio(alvo.value.id) : banido;
    if (registrado.ok) return ok(undefined);

    // O usuário JÁ está desativado e auditado (a RLS já nega o acesso); só o bloqueio no Auth
    // falhou. Não apresenta isso como falha total (mesmo padrão do EstadoInconsistenteError).
    this.erros.registrar(
      `Falha ao bloquear conta desativada (id=${alvo.value.id}):`,
      registrado.error.message,
    );
    return err(
      new EstadoInconsistenteError(
        "Usuário desativado, mas o bloqueio da conta falhou. Ele segue na lista como bloqueio pendente: conclua o bloqueio por lá.",
        alvo.value.id,
      ),
    );
  }
}

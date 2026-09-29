import { usuarioParaDto } from "@/modules/usuarios/application/mappers/usuario-para-dto.mapper";
import type {
  CriarUsuarioInput,
  CriarUsuarioOutput,
  CriarUsuarioPort,
} from "@/modules/usuarios/application/ports/in/criar-usuario.provider";
import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AuthAdminPort } from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class CriarUsuario implements CriarUsuarioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(input: CriarUsuarioInput): Promise<Result<CriarUsuarioOutput, AppError>> {
    const atorId = await this.sessao.usuarioAtualId();
    if (!atorId) return err(new ForbiddenError("Sessão inválida."));

    const perfilAtor = await this.usuarios.buscarPorId(atorId);
    // Erro técnico não vira "sem permissão" (devolutiva #55, ponto 02): propaga o
    // AppError original em vez de mascará-lo como Forbidden.
    if (!perfilAtor.ok) return perfilAtor;
    const ator = perfilAtor.value;
    if (!ator || !ator.papel.ehAdmin()) {
      return err(new ForbiddenError("Só Admin cadastra Líder/Funcionário."));
    }

    const conta = await this.authAdmin.criarConta(input.email);
    if (!conta.ok) {
      await this.registrarAuditoria(ator.id, input, "falha");
      return conta;
    }

    const construido = Usuario.builder()
      .comId(conta.value.id)
      .comNome(input.nome)
      .comEmail(input.email)
      .comPapel(input.papel)
      .comSetor(input.setor)
      .build();
    if (!construido.ok) {
      await this.registrarAuditoria(ator.id, input, "falha");
      return construido;
    }

    const salvo = await this.usuarios.criar(construido.value);
    if (!salvo.ok) {
      await this.registrarAuditoria(ator.id, input, "falha");
      return salvo;
    }

    await this.registrarAuditoria(ator.id, input, "sucesso");

    return ok({
      usuario: usuarioParaDto(construido.value),
      senhaProvisoria: conta.value.senhaProvisoria,
    });
  }

  private async registrarAuditoria(
    atorId: string,
    input: CriarUsuarioInput,
    resultado: "sucesso" | "falha",
  ): Promise<void> {
    await this.auditoria.registrar({
      ator: atorId,
      setor: input.setor,
      acao: "usuario.criar",
      alvo: input.email,
      resultado,
    });
  }
}

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
      await this.registrarAuditoriaBestEffort(ator.id, input, "falha");
      return conta;
    }

    const construido = Usuario.builder()
      .comId(conta.value.id)
      .comNome(input.nome)
      .comEmail(input.email)
      .comPapel(input.papel)
      .comSetor(input.setor)
      .build();
    if (!construido.ok)
      return this.falharComCompensacao(ator.id, input, conta.value.id, construido);

    const salvo = await this.usuarios.criar(construido.value);
    if (!salvo.ok) return this.falharComCompensacao(ator.id, input, conta.value.id, salvo);

    // Devolutiva técnica PR #61, ponto 2: auditoria de sucesso deixa de ser
    // best-effort — se não fica registrada, a operação inteira é revertida
    // (conta Auth + perfil, via compensação do ponto 1), porque o critério de
    // aceite do #30 ("Ação fica registrada na auditoria") não é opcional.
    const auditoria = await this.auditoria.registrar({
      ator: ator.id,
      setor: input.setor,
      acao: "usuario.criar",
      alvo: input.email,
      resultado: "sucesso",
    });
    if (!auditoria.ok) return this.falharComCompensacao(ator.id, input, conta.value.id, auditoria);

    return ok({
      usuario: usuarioParaDto(construido.value),
      senhaProvisoria: conta.value.senhaProvisoria,
    });
  }

  // Devolutiva técnica PR #61, ponto 1: qualquer falha depois da conta Auth já
  // criada compensa removendo-a — `perfis.id` referencia `auth.users(id) on
  // delete cascade`, então isso limpa o perfil junto se ele chegou a existir.
  // Falha da própria compensação não é mascarada (log observável), mas também
  // não interrompe: o resultado devolvido ao chamador é sempre o erro
  // original, nunca o erro de uma compensação que o chamador não pediu.
  private async falharComCompensacao(
    atorId: string,
    input: CriarUsuarioInput,
    contaId: string,
    resultadoComErro: { ok: false; error: AppError },
  ): Promise<Result<CriarUsuarioOutput, AppError>> {
    const removido = await this.authAdmin.removerConta(contaId);
    if (!removido.ok) {
      console.error(
        `Falha ao compensar conta Auth órfã (id=${contaId}) após erro original (${resultadoComErro.error.message}):`,
        removido.error.message,
      );
    }
    await this.registrarAuditoriaBestEffort(atorId, input, "falha");
    return resultadoComErro;
  }

  // Auditoria do caminho de FALHA continua best-effort de propósito: se a
  // operação já falhou, não vale a pena um segundo modo de falha em cima da
  // tentativa de registrar que ela falhou — o critério de aceite do #30 é
  // sobre o sucesso ficar auditável, não sobre blindar a auditoria de falhas.
  private async registrarAuditoriaBestEffort(
    atorId: string,
    input: CriarUsuarioInput,
    resultado: "falha",
  ): Promise<void> {
    const registrado = await this.auditoria.registrar({
      ator: atorId,
      setor: input.setor,
      acao: "usuario.criar",
      alvo: input.email,
      resultado,
    });
    if (!registrado.ok) console.error("Falha ao registrar auditoria:", registrado.error.message);
  }
}

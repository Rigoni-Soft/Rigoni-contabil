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
import { AutorizacaoService } from "@/modules/usuarios/domain/services/autorizacao.service";
import { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class CriarUsuario implements CriarUsuarioPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly usuarios: UsuarioRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly auditoria: AuditoriaPort,
    private readonly autorizacao = new AutorizacaoService(),
  ) {}

  async execute(input: CriarUsuarioInput): Promise<Result<CriarUsuarioOutput, AppError>> {
    const atorId = await this.sessao.usuarioAtualId();
    if (!atorId) return err(new ForbiddenError("Sessão inválida."));

    const perfilAtor = await this.usuarios.buscarPorId(atorId);
    // Erro técnico não vira "sem permissão": propaga o AppError original em vez
    // de mascará-lo como Forbidden.
    if (!perfilAtor.ok) return perfilAtor;
    const ator = perfilAtor.value;
    // JWT de quem foi desativado vale até expirar; o perfil é a fonte da verdade.
    if (!ator || ator.estaDesativado() || !this.podeCadastrar(ator, input)) {
      return err(
        new ForbiddenError(
          "Só Admin cadastra Líder/Funcionário; Líder só cadastra Funcionário do próprio Setor.",
        ),
      );
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
      return this.falharComCompensacao(
        ator.id,
        input,
        conta.value.id,
        "construir_perfil",
        construido,
      );

    const salvo = await this.usuarios.criar(construido.value);
    if (!salvo.ok)
      return this.falharComCompensacao(ator.id, input, conta.value.id, "salvar_perfil", salvo);

    // Auditoria de sucesso não é best-effort: se não fica registrada, a operação inteira é
    // revertida (conta Auth + perfil, via compensação), porque a ação precisa ficar auditada.
    const auditoria = await this.auditoria.registrar({
      ator: ator.id,
      setor: input.setor,
      acao: "usuario.criar",
      alvo: input.email,
      resultado: "sucesso",
    });
    if (!auditoria.ok)
      return this.falharComCompensacao(
        ator.id,
        input,
        conta.value.id,
        "registrar_auditoria",
        auditoria,
      );

    return ok({
      usuario: usuarioParaDto(construido.value),
      senhaProvisoria: conta.value.senhaProvisoria,
    });
  }

  // "Admin ou mesmo Setor" já é regra do AutorizacaoService (domain service, mesma
  // instância usada por ListarSetores) — aqui só soma a restrição específica deste
  // caso de uso: Líder só cadastra Funcionário, nunca outro Líder/Admin.
  private podeCadastrar(ator: Usuario, input: CriarUsuarioInput): boolean {
    if (ator.papel.ehAdmin()) return true;
    if (!ator.papel.ehLiderSetor() || input.papel !== "funcionario") return false;
    const setor = Setor.criar(input.setor);
    return setor.ok && this.autorizacao.podeAcessarSetor(ator, setor.value);
  }

  // Qualquer falha depois da conta Auth criada a compensa removendo-a (`perfis.id` tem `on delete
  // cascade`, então o perfil sai junto). Falha da própria compensação vira
  // `EstadoInconsistenteError` (conta pode ter ficado órfã) e auditoria `falha_compensacao`, para
  // reconciliação manual via Supabase Studio. Senha provisória nunca entra no log.
  private async falharComCompensacao(
    atorId: string,
    input: CriarUsuarioInput,
    contaId: string,
    etapa: string,
    resultadoComErro: { ok: false; error: AppError },
  ): Promise<Result<CriarUsuarioOutput, AppError>> {
    const removido = await this.authAdmin.removerConta(contaId);
    if (!removido.ok) {
      console.error(
        `Falha ao compensar conta Auth órfã (id=${contaId}, email=${input.email}, etapa=${etapa}) ` +
          `após erro original (${resultadoComErro.error.message}):`,
        removido.error.message,
      );
      await this.registrarAuditoriaBestEffort(atorId, input, "falha_compensacao");
      return err(
        new EstadoInconsistenteError(
          "Falha ao criar usuário e também ao desfazer a conta criada. Conta pode ter ficado " +
            "órfã — contate o suporte técnico.",
          contaId,
        ),
      );
    }
    await this.registrarAuditoriaBestEffort(atorId, input, "falha");
    return resultadoComErro;
  }

  // Auditoria do caminho de FALHA é best-effort de propósito: não vale um segundo
  // modo de falha em cima da tentativa de registrar que a operação já falhou.
  private async registrarAuditoriaBestEffort(
    atorId: string,
    input: CriarUsuarioInput,
    resultado: "falha" | "falha_compensacao",
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

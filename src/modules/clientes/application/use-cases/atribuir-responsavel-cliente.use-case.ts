import type {
  AtribuirResponsavelClienteInput,
  AtribuirResponsavelClientePort,
} from "@/modules/clientes/application/ports/in/atribuir-responsavel-cliente.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeAtribuirResponsavel } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só o Líder do Simples Nacional atribui/troca/remove o Responsável (#65). O
// banco repete a regra (trigger + RLS) — aqui é a primeira barreira e o ponto
// que registra a auditoria (a ação distingue atribuir, trocar e remover).
export class AtribuirResponsavelCliente implements AtribuirResponsavelClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
    private readonly responsaveis: ResponsavelClienteRepository,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(input: AtribuirResponsavelClienteInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeAtribuirResponsavel(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Só o Líder do Simples Nacional atribui o Responsável."));
    }

    const cliente = await this.query.buscarCadastroOperacional(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) {
      return err(
        new NotFoundError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );
    }

    // Sem mudança: nada a gravar nem a auditar.
    if (cliente.value.responsavelId === input.responsavelId) return ok(undefined);

    const acao = this.nomeDaAcao(cliente.value.responsavelId, input.responsavelId);
    const elegivel = await this.validarElegivel(input.responsavelId);
    if (!elegivel.ok) {
      await this.registrarAuditoria(ator, acao, cliente.value.cnpj, "falha");
      return elegivel;
    }

    const salvo = await this.responsaveis.atribuir(input.clienteId, input.responsavelId);
    await this.registrarAuditoria(ator, acao, cliente.value.cnpj, salvo.ok ? "sucesso" : "falha");
    return salvo;
  }

  private nomeDaAcao(atual: string | null, novo: string | null): string {
    if (novo === null) return "cliente.remover-responsavel";
    return atual === null ? "cliente.atribuir-responsavel" : "cliente.trocar-responsavel";
  }

  private async validarElegivel(responsavelId: string | null): Promise<Result<void, AppError>> {
    if (responsavelId === null) return ok(undefined);
    const elegiveis = await this.query.listarResponsaveisElegiveis();
    if (!elegiveis.ok) return elegiveis;
    if (!elegiveis.value.some((funcionario) => funcionario.id === responsavelId)) {
      return err(
        new ValidationError("O Responsável deve ser Funcionário do Simples Nacional.", {
          responsavelId: ["Funcionário inválido"],
        }),
      );
    }
    return ok(undefined);
  }

  private async registrarAuditoria(
    ator: AtorSessaoDto,
    acao: string,
    cnpj: string,
    resultado: "sucesso" | "falha",
  ): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao,
      alvo: cnpj,
      resultado,
    });
  }
}

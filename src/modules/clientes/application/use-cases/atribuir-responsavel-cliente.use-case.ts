import type {
  AtribuirResponsavelClienteInput,
  AtribuirResponsavelClienteOutput,
  AtribuirResponsavelClientePort,
} from "@/modules/clientes/application/ports/in/atribuir-responsavel-cliente.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteQueryPort } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só o Líder do Simples Nacional atribui/troca/remove o Responsável (#65). O
// banco repete a regra (trigger + RLS) — aqui é a primeira barreira e o ponto
// que registra a auditoria.
export class AtribuirResponsavelCliente implements AtribuirResponsavelClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly query: ClienteQueryPort,
    private readonly responsaveis: ResponsavelClienteRepository,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(
    input: AtribuirResponsavelClienteInput,
  ): Promise<Result<AtribuirResponsavelClienteOutput, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel !== "lider_setor" || ator.setor !== "simples_nacional") {
      return err(new ForbiddenError("Só o Líder do Simples Nacional atribui o Responsável."));
    }

    const cliente = await this.clientes.buscarPorId(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value)
      return err(
        new ForbiddenError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );

    const elegivel = await this.validarElegivel(input.responsavelId);
    if (!elegivel.ok) {
      await this.registrarAuditoria(ator, cliente.value.cnpj.digitos, "falha");
      return elegivel;
    }

    const salvo = await this.responsaveis.atribuir(input.clienteId, input.responsavelId);
    await this.registrarAuditoria(ator, cliente.value.cnpj.digitos, salvo.ok ? "sucesso" : "falha");
    if (!salvo.ok) return salvo;
    return ok({ clienteId: input.clienteId });
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
    cnpj: string,
    resultado: "sucesso" | "falha",
  ): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "cliente.atribuir-responsavel",
      alvo: cnpj,
      resultado,
    });
  }
}

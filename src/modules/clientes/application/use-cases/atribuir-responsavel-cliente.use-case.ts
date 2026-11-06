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
import { ehSetor, type SetorSlug } from "@/shared/kernel/setores";

// Só o Líder do Setor atribui/troca/remove o Responsável do Cliente naquele Setor. O banco repete a regra
// (trigger + RLS) — aqui é a primeira barreira e o ponto que registra a auditoria de falha (a ação
// distingue atribuir, trocar e remover). A de sucesso nasce no banco, na mesma transação da escrita
// (trigger `auditar_responsavel_cliente`), inclusive quando o Líder grava pela Data API.
export class AtribuirResponsavelCliente implements AtribuirResponsavelClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly query: ClienteQueryPort,
    private readonly responsaveis: ResponsavelClienteRepository,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(input: AtribuirResponsavelClienteInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !ehSetor(ator.setor) || !podeAtribuirResponsavel(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Só o Líder do Setor atribui o Responsável."));
    }

    const cliente = await this.query.buscarCadastroOperacional(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) {
      return err(
        new NotFoundError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );
    }

    const atual = await this.responsavelAtual(
      ator.setor,
      cliente.value.responsavelId,
      input.clienteId,
    );
    if (!atual.ok) return atual;
    // Sem mudança: nada a gravar nem a auditar.
    if (atual.value === input.responsavelId) return ok(undefined);

    const acao = this.nomeDaAcao(atual.value, input.responsavelId);
    const elegivel = await this.validarElegivel(ator.setor, input.responsavelId);
    if (!elegivel.ok) {
      await this.registrarAuditoria(ator, acao, cliente.value.cnpj);
      return elegivel;
    }

    const salvo = await this.responsaveis.atribuir(
      input.clienteId,
      ator.setor,
      input.responsavelId,
    );
    if (!salvo.ok) await this.registrarAuditoria(ator, acao, cliente.value.cnpj);
    return salvo;
  }

  private nomeDaAcao(atual: string | null, novo: string | null): string {
    if (novo === null) return "cliente.remover-responsavel";
    return atual === null ? "cliente.atribuir-responsavel" : "cliente.trocar-responsavel";
  }

  // O SN lê do cadastro operacional; os demais Setores, de `cliente_responsaveis`.
  private async responsavelAtual(
    setor: SetorSlug,
    doCadastroSn: string | null,
    clienteId: string,
  ): Promise<Result<string | null, AppError>> {
    if (setor === "simples_nacional") return ok(doCadastroSn);
    const atual = await this.query.buscarResponsavelDoSetor(clienteId, setor);
    return atual.ok ? ok(atual.value?.id ?? null) : atual;
  }

  private async validarElegivel(
    setor: SetorSlug,
    responsavelId: string | null,
  ): Promise<Result<void, AppError>> {
    if (responsavelId === null) return ok(undefined);
    const elegiveis = await this.query.listarResponsaveisElegiveis(setor);
    if (!elegiveis.ok) return elegiveis;
    if (!elegiveis.value.some((funcionario) => funcionario.id === responsavelId)) {
      return err(
        new ValidationError("O Responsável deve ser Funcionário ativo do Setor.", {
          responsavelId: ["Funcionário inválido"],
        }),
      );
    }
    return ok(undefined);
  }

  private async registrarAuditoria(ator: AtorSessaoDto, acao: string, cnpj: string): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao,
      alvo: cnpj,
      resultado: "falha",
    });
  }
}

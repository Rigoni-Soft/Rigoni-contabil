import type { AcompanhamentoFuncionariosDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem competência, o mês corrente. Com `funcionarioId`, devolve também o detalhe dele.
export type ObterAcompanhamentoFuncionariosInput = { competencia?: string; funcionarioId?: string };

export interface ObterAcompanhamentoFuncionariosPort {
  execute(
    input: ObterAcompanhamentoFuncionariosInput,
  ): Promise<Result<AcompanhamentoFuncionariosDto, AppError>>;
}

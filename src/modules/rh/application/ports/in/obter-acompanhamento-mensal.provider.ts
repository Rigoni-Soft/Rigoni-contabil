import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem competência, o mês corrente.
export type ObterAcompanhamentoMensalInput = { competencia?: string };

export interface ObterAcompanhamentoMensalPort {
  execute(
    input: ObterAcompanhamentoMensalInput,
  ): Promise<Result<AcompanhamentoMensalDto, AppError>>;
}

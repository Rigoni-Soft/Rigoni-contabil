import type { ConvencoesDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ObterConvencoesDoClienteInput = { clienteId: string };

export interface ObterConvencoesDoClientePort {
  execute(input: ObterConvencoesDoClienteInput): Promise<Result<ConvencoesDoClienteDto, AppError>>;
}

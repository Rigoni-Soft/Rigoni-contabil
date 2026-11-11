import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem competência, o mês corrente; sem quinzena, a primeira; sem empregado, o primeiro ativo.
export type ObterFolhaDePontoInput = {
  clienteId: string;
  competencia?: string;
  quinzena?: 1 | 2;
  empregadoId?: string;
};

export interface ObterFolhaDePontoPort {
  execute(input: ObterFolhaDePontoInput): Promise<Result<FolhaDePontoDto, AppError>>;
}

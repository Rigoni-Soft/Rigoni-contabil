import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem competência, o mês corrente; sem empregado, nenhum cartão (o quadro abre no formulário novo).
export type ObterFolhaDePontoInput = {
  clienteId: string;
  competencia?: string;
  empregadoId?: string;
};

export interface ObterFolhaDePontoPort {
  execute(input: ObterFolhaDePontoInput): Promise<Result<FolhaDePontoDto, AppError>>;
}

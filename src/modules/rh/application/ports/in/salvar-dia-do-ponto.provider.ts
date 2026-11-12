import type { ParDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SalvarDiaDoPontoInput = {
  empregadoId: string;
  data: string;
  batidas: ParDto[];
  extra: ParDto | null;
  abono: boolean;
};

export interface SalvarDiaDoPontoPort {
  execute(input: SalvarDiaDoPontoInput): Promise<Result<void, AppError>>;
}

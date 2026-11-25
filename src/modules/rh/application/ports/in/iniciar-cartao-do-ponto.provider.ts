import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type IniciarCartaoDoPontoInput = { empregadoId: string; competencia: string };

export interface IniciarCartaoDoPontoPort {
  execute(input: IniciarCartaoDoPontoInput): Promise<Result<void, AppError>>;
}

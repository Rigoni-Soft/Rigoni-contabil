import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LembretesParcelamentoPgfnExecutados = {
  executado: boolean;
  alertas: number;
  falhas: number;
};

export interface ExecutarLembretesParcelamentoPgfnPort {
  execute(): Promise<Result<LembretesParcelamentoPgfnExecutados, AppError>>;
}

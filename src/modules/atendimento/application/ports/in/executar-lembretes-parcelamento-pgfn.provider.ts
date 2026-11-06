import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LembretesParcelamentoPgfnExecutados = {
  // `false`: hoje não é dia de rodar (1, 10 e 15); nada foi lido nem alterado.
  executado: boolean;
  alertas: number;
  falhas: number;
};

export interface ExecutarLembretesParcelamentoPgfnPort {
  execute(): Promise<Result<LembretesParcelamentoPgfnExecutados, AppError>>;
}

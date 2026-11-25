import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnvioGuiaParcelamentoExecutado = {
  executado: boolean;
  enviados: number;
  alertas: number;
  falhas: number;
};

export interface ExecutarEnvioGuiaParcelamentoPort {
  execute(): Promise<Result<EnvioGuiaParcelamentoExecutado, AppError>>;
}

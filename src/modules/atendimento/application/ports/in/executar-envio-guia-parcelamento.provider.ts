import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnvioGuiaParcelamentoExecutado = {
  // `false`: hoje não é dia de rodar (20/22/24/26/28); nada foi lido nem enviado.
  executado: boolean;
  enviados: number;
  alertas: number;
  falhas: number;
};

export interface ExecutarEnvioGuiaParcelamentoPort {
  execute(): Promise<Result<EnvioGuiaParcelamentoExecutado, AppError>>;
}

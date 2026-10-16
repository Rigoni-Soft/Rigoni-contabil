import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LembretesExecutados = {
  // `false`: hoje não é dia de rodar (01/05/10/15); nada foi lido nem enviado.
  executado: boolean;
  lembretes: number;
  dasEnviados: number;
  alertas: number;
  falhas: number;
};

export interface ExecutarLembretesDocumentoEDasPort {
  execute(): Promise<Result<LembretesExecutados, AppError>>;
}

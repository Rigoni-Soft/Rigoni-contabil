import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type LembretesExecutados = {
  executado: boolean;
  lembretes: number;
  dasEnviados: number;
  alertas: number;
  falhas: number;
};

export interface ExecutarLembretesDocumentoEDasPort {
  execute(): Promise<Result<LembretesExecutados, AppError>>;
}

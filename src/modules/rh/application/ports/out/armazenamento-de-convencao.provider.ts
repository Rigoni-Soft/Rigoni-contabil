import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ArmazenamentoDeConvencaoPort {
  enviar(caminho: string, pdf: Uint8Array): Promise<Result<void, AppError>>;
  remover(caminho: string): Promise<Result<void, AppError>>;
}

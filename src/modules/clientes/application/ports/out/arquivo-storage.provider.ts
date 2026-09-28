import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ArquivoStoragePort {
  enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>>;
}

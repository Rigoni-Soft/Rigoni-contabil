import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O PDF da convenção fica em armazenamento privado; só o servidor grava e remove.
export interface ArmazenamentoDeConvencaoPort {
  enviar(caminho: string, pdf: Uint8Array): Promise<Result<void, AppError>>;
  // Compensação: tira o arquivo quando o cadastro falha depois do envio.
  remover(caminho: string): Promise<Result<void, AppError>>;
}

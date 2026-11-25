import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EntregarNaUraInput = { clienteId: string; telefone: string };

export interface EntregarNaUraPort {
  execute(pedido: EntregarNaUraInput): Promise<Result<void, AppError>>;
}

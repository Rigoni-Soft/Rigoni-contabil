import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ClienteCnpjPort {
  // CNPJ normalizado do cadastro do Cliente; `NotFoundError` se o Cliente não existe.
  cnpjDoCliente(clienteId: string): Promise<Result<string, AppError>>;
}

import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CadastroFiscalCliente = { cnpj: string; regime: string };

export interface ClienteCnpjPort {
  // CNPJ (normalizado) e Regime do cadastro do Cliente; `NotFoundError` se o Cliente não existe.
  cadastroFiscalDoCliente(clienteId: string): Promise<Result<CadastroFiscalCliente, AppError>>;
}

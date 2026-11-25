import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CadastroFiscalCliente = { cnpj: string; regime: string };

export interface ClienteCnpjPort {
  cadastroFiscalDoCliente(clienteId: string): Promise<Result<CadastroFiscalCliente, AppError>>;
}

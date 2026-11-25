import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContatoIdentificado = {
  clienteId: string;
  nome: string;
  empresa: string;
};

export type ContatoAmbiguo = "ambiguo";

export interface IdentificacaoContatoPort {
  identificar(
    telefone: string,
  ): Promise<Result<ContatoIdentificado | ContatoAmbiguo | null, AppError>>;
  cnpjCadastrado(cnpj: string): Promise<Result<boolean, AppError>>;
  regimeDoCliente(clienteId: string): Promise<Result<string | null, AppError>>;
}

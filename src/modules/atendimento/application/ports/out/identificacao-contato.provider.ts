import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContatoIdentificado = {
  clienteId: string;
  nome: string;
  empresa: string;
  padrao: boolean;
};

// O número consta como Contato de mais de um Cliente: nenhum é escolhido automaticamente.
export type ContatoAmbiguo = "ambiguo";

export interface IdentificacaoContatoPort {
  // `telefone` só com dígitos, sem DDI. null = número não pertence a nenhum Cliente.
  identificar(
    telefone: string,
  ): Promise<Result<ContatoIdentificado | ContatoAmbiguo | null, AppError>>;
  // O CNPJ (já normalizado, ver `normalizarCnpj`) pertence a algum Cliente cadastrado?
  cnpjCadastrado(cnpj: string): Promise<Result<boolean, AppError>>;
}

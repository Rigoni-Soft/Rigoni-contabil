import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContatoIdentificado = { nome: string; empresa: string; padrao: boolean };

export interface IdentificacaoContatoPort {
  // `telefone` só com dígitos, sem DDI. null = número não pertence a nenhum Cliente.
  identificar(telefone: string): Promise<Result<ContatoIdentificado | null, AppError>>;
}

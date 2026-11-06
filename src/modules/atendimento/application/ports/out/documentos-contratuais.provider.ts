import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `numero` e `data` (AAAA-MM-DD) só existem nas alterações; o contrato social não tem.
export type DocumentoContratual = {
  tipo: "contrato" | "alteracao";
  numero: number | null;
  data: string | null;
  caminho: string;
};

export interface DocumentosContratuaisPort {
  // Contrato social primeiro, depois as alterações por nº decrescente.
  listar(clienteId: string): Promise<Result<DocumentoContratual[], AppError>>;
  // Endereço de curta duração: só serve para o provedor de mensagens buscar o arquivo.
  linkTemporario(caminho: string): Promise<Result<string, AppError>>;
}

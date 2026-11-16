import { AppError } from "@/shared/errors/app.error";

// Falha ao montar um documento (PDF) no servidor: esperada, vira mensagem na tela.
export class GeracaoDeDocumentoError extends AppError {
  readonly code = "DOCUMENT_GENERATION_ERROR";
}

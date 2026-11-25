import { AppError } from "@/shared/errors/app.error";

export class GeracaoDeDocumentoError extends AppError {
  readonly code = "DOCUMENT_GENERATION_ERROR";
}

import { AppError } from "@/shared/errors/app.error";

export class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

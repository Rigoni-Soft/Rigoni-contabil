import { AppError } from "@/shared/errors/app.error";

export class ConsultaError extends AppError {
  readonly code = "CONSULTA_ERROR";
}

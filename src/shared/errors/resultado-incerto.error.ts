import { AppError } from "@/shared/errors/app.error";

export class ResultadoIncertoError extends AppError {
  readonly code = "RESULTADO_INCERTO";
}

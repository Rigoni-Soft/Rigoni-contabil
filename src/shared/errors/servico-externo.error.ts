import { AppError } from "@/shared/errors/app.error";

export class ServicoExternoError extends AppError {
  readonly code = "EXTERNAL_SERVICE_ERROR";
}

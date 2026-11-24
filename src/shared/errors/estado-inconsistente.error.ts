import { AppError } from "@/shared/errors/app.error";

export class EstadoInconsistenteError extends AppError {
  readonly code = "INCONSISTENT_STATE";

  constructor(
    message: string,
    readonly referenciaId: string,
  ) {
    super(message);
  }
}

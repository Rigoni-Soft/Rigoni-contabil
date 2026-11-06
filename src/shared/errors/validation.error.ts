import { AppError } from "@/shared/errors/app.error";

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

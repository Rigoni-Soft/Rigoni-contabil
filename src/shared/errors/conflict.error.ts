import { AppError } from "@/shared/errors/app.error";

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
}

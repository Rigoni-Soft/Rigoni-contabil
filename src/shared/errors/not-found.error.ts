import { AppError } from "@/shared/errors/app.error";

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
}

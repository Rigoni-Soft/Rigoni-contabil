import { AppError } from "@/shared/errors/app.error";

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
}

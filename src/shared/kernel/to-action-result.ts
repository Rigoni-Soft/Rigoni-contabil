import type { ActionResult } from "@/shared/dtos/action-result.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import type { Result } from "@/shared/kernel/result";

export function toActionResult<T>(resultado: Result<T, AppError>): ActionResult<T> {
  if (resultado.ok) return { ok: true, data: resultado.value };

  const { error } = resultado;
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && error.fields ? { fields: error.fields } : {}),
    },
  };
}

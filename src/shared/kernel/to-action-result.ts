import type { ActionResult } from "@/shared/dtos/action-result.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import type { Result } from "@/shared/kernel/result";

// Converte o Result de um caso de uso pra ActionResult preservando `fields`
// quando o erro é um ValidationError — sem isso, um CNPJ/campo inválido
// detectado só no domínio virava uma mensagem genérica ("Dados inválidos")
// sem apontar qual campo, porque cada *.actions.ts remontava o erro à mão e
// esquecia de repassar `fields` (achado real, 2026-09-29, replicado nos 6
// *.actions.ts do projeto antes desta função existir).
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

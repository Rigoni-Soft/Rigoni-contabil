import { z } from "zod";

import type { ActionResult } from "@/shared/dtos/action-result.dto";

// Entrada que não passou no schema Zod da action: aponta os campos inválidos, sem chamar o caso de uso.
export function dadosInvalidos(erro: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos.",
      fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
    },
  };
}

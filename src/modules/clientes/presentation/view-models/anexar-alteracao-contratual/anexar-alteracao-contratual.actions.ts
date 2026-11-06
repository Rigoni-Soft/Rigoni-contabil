"use server";

import { z } from "zod";

import { makeAnexarAlteracaoContratual } from "@/main/clientes.factory";
import { anexarAlteracaoContratualSchema } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function anexarAlteracaoContratualAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = anexarAlteracaoContratualSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      },
    };
  }

  const anexar = await makeAnexarAlteracaoContratual();
  return toActionResult(await anexar.execute(parsed.data));
}

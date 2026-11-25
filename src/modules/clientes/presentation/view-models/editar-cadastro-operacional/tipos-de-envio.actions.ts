"use server";

import { z } from "zod";

import { makeDefinirTiposDeEnvioDoContato } from "@/main/clientes.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import { definirTiposSchema } from "./tipos-de-envio.schema";

export async function definirTiposDoContatoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = definirTiposSchema.safeParse(input);
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

  const definir = await makeDefinirTiposDeEnvioDoContato();
  return toActionResult(await definir.execute(parsed.data));
}

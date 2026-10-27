"use server";

import { z } from "zod";

import { makeSalvarParcelamentosCliente } from "@/main/clientes.factory";
import { salvarParcelamentosSchema } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function salvarParcelamentosAction(input: unknown): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = salvarParcelamentosSchema.safeParse(input);
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

  const salvar = await makeSalvarParcelamentosCliente();
  return toActionResult(await salvar.execute(parsed.data));
}

"use server";

import { z } from "zod";

import { makeSalvarContatoDoCliente } from "@/main/clientes.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import { contatoSchema } from "./editar-cadastro-operacional.schema";

const salvarContatoSchema = z.object({
  clienteId: z.string().uuid(),
  contato: contatoSchema,
});

export async function salvarContatoAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = salvarContatoSchema.safeParse(input);
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

  const salvar = await makeSalvarContatoDoCliente();
  return toActionResult(await salvar.execute(parsed.data));
}

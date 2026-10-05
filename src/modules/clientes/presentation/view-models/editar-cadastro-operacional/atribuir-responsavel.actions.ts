"use server";

import { z } from "zod";

import { makeAtribuirResponsavelCliente } from "@/main/clientes.factory";
import type { AtribuirResponsavelClienteOutput } from "@/modules/clientes/application/ports/in/atribuir-responsavel-cliente.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

const schema = z.object({
  clienteId: z.string().uuid(),
  responsavelId: z.string().uuid().nullable(),
});

export async function atribuirResponsavelAction(
  input: unknown,
): Promise<ActionResult<AtribuirResponsavelClienteOutput>> {
  const parsed = schema.safeParse(input);
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

  const atribuir = await makeAtribuirResponsavelCliente();
  return toActionResult(await atribuir.execute(parsed.data));
}

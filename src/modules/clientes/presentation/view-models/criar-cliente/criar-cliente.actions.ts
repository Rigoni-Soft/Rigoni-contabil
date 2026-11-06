"use server";

import { z } from "zod";

import { makeCriarCliente } from "@/main/clientes.factory";
import type { CriarClienteOutput } from "@/modules/clientes/application/ports/in/criar-cliente.provider";
import { criarClienteSchema } from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function criarClienteAction(
  input: unknown,
): Promise<ActionResult<CriarClienteOutput>> {
  const parsed = criarClienteSchema.safeParse(input);
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

  const criarCliente = await makeCriarCliente();
  return toActionResult(await criarCliente.execute(parsed.data));
}

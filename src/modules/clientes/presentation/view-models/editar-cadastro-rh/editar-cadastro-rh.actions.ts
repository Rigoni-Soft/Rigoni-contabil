"use server";

import { z } from "zod";

import { makeEditarCadastroRhCliente } from "@/main/clientes.factory";
import { editarCadastroRhSchema } from "@/modules/clientes/presentation/view-models/editar-cadastro-rh/editar-cadastro-rh.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function editarCadastroRhAction(
  input: unknown,
): Promise<ActionResult<{ clienteId: string }>> {
  const parsed = editarCadastroRhSchema.safeParse(input);
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

  const editar = await makeEditarCadastroRhCliente();
  return toActionResult(await editar.execute(parsed.data));
}

"use server";

import { z } from "zod";

import { makeEditarCadastroOperacionalCliente } from "@/main/clientes.factory";
import type { EditarCadastroOperacionalClienteOutput } from "@/modules/clientes/application/ports/in/editar-cadastro-operacional-cliente.provider";
import { editarCadastroOperacionalSchema } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function editarCadastroOperacionalAction(
  input: unknown,
): Promise<ActionResult<EditarCadastroOperacionalClienteOutput>> {
  const parsed = editarCadastroOperacionalSchema.safeParse(input);
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

  const editar = await makeEditarCadastroOperacionalCliente();
  return toActionResult(await editar.execute(parsed.data));
}

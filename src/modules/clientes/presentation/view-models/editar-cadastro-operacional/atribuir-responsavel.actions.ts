"use server";

import { z } from "zod";

import {
  makeAtribuirResponsavelCliente,
  makeListarResponsaveisElegiveis,
} from "@/main/clientes.factory";
import type { ResponsavelOpcaoDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

const schema = z.object({
  clienteId: z.string().uuid(),
  // guid, não uuid: ids do seed (2222…, 8888…) não são v4/variante válida e o
  // z.uuid() os recusava com "Dados inválidos" (mesmo problema já visto no #36).
  responsavelId: z.guid().nullable(),
});

export async function atribuirResponsavelAction(input: unknown): Promise<ActionResult<void>> {
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

export async function listarResponsaveisElegiveisAction(): Promise<
  ActionResult<ResponsavelOpcaoDto[]>
> {
  const listar = await makeListarResponsaveisElegiveis();
  return toActionResult(await listar.execute());
}

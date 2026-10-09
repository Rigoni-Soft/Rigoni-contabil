"use server";

import { z } from "zod";

import { makeListarFila } from "@/main/atendimento.factory";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { SETORES } from "@/shared/kernel/setores";
import { toActionResult } from "@/shared/kernel/to-action-result";

const setorSchema = z.enum(SETORES);

export async function listarFilaAction(setor: unknown): Promise<ActionResult<ItemDaFilaVisto[]>> {
  const parsed = setorSchema.safeParse(setor);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Setor inválido." },
    };
  }

  const listarFila = await makeListarFila();
  return toActionResult(await listarFila.execute({ setor: parsed.data }));
}

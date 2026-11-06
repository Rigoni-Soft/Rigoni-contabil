"use server";

import { z } from "zod";

import { makeListarRegistros } from "@/main/auditoria.factory";
import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { filtroFeedSchema } from "@/modules/auditoria/presentation/view-models/feed/feed.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function listarRegistrosAction(
  input: unknown,
): Promise<ActionResult<RegistroAcaoDto[]>> {
  const parsed = filtroFeedSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Filtro inválido.",
        fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      },
    };
  }

  const listarRegistros = await makeListarRegistros();
  return toActionResult(await listarRegistros.execute(parsed.data));
}

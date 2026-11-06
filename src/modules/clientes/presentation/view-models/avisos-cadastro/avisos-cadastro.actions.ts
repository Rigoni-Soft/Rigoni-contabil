"use server";

import { z } from "zod";

import {
  makeContarAvisosNaoVistos,
  makeListarAvisosCadastro,
  makeMarcarAvisoVisto,
} from "@/main/clientes.factory";
import type { PaginaAvisosCadastro } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

// guid, não uuid: ids do seed não são v4 (mesmo motivo de atribuir-responsavel.actions).
const cursorSchema = z
  .object({
    visto: z.boolean(),
    criadoEm: z.iso.datetime({ offset: true }),
    id: z.guid(),
  })
  .nullish();

// Server Action é endpoint público (arquitetura.md §3.13): o cursor é validado mesmo vindo da UI.
export async function listarAvisosCadastroAction(
  cursor: unknown,
): Promise<ActionResult<PaginaAvisosCadastro>> {
  const parsed = cursorSchema.safeParse(cursor);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Cursor inválido.",
        fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      },
    };
  }

  const listar = await makeListarAvisosCadastro();
  return toActionResult(await listar.execute(parsed.data ?? null));
}

export async function contarAvisosNaoVistosAction(): Promise<ActionResult<number>> {
  const contar = await makeContarAvisosNaoVistos();
  return toActionResult(await contar.execute());
}

export async function marcarAvisoVistoAction(avisoId: unknown): Promise<ActionResult<void>> {
  const parsed = z.guid().safeParse(avisoId);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Aviso inválido." } };
  }

  const marcar = await makeMarcarAvisoVisto();
  return toActionResult(await marcar.execute(parsed.data));
}

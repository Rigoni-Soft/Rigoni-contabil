"use server";

import { z } from "zod";

import { makeListarAtendimentosDaEquipe } from "@/main/atendimento.factory";
import type { AtendimentoDaEquipeVisto } from "@/modules/atendimento/application/ports/in/listar-atendimentos-da-equipe.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { SETORES } from "@/shared/kernel/setores";
import { toActionResult } from "@/shared/kernel/to-action-result";

const setorSchema = z.enum(SETORES);

export async function listarAtendimentosDaEquipeAction(
  setor: unknown,
): Promise<ActionResult<AtendimentoDaEquipeVisto[]>> {
  const parsed = setorSchema.safeParse(setor);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Setor inválido." } };
  }
  const listar = await makeListarAtendimentosDaEquipe();
  return toActionResult(await listar.execute({ setor: parsed.data }));
}

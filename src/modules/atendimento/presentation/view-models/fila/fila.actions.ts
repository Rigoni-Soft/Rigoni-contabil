"use server";

import { z } from "zod";

import { makeAssumirAtendimento, makeListarFila } from "@/main/atendimento.factory";
import type { AtendimentoAssumidoPeloUsuario } from "@/modules/atendimento/application/ports/in/assumir-atendimento.provider";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { atendimentoIdSchema } from "@/modules/atendimento/presentation/view-models/conversa/conversa.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { SETORES } from "@/shared/kernel/setores";
import { toActionResult } from "@/shared/kernel/to-action-result";

// Sem Setor: a Fila do Setor do próprio usuário (aviso global da Fila).
const setorSchema = z.enum(SETORES).optional();

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

export async function assumirAtendimentoAction(
  atendimentoId: unknown,
): Promise<ActionResult<AtendimentoAssumidoPeloUsuario>> {
  const parsed = atendimentoIdSchema.safeParse(atendimentoId);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Atendimento inválido." } };
  }

  const assumir = await makeAssumirAtendimento();
  return toActionResult(await assumir.execute({ atendimentoId: parsed.data }));
}

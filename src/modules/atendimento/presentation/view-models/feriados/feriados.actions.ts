"use server";

import { z } from "zod";

import { makeCadastrarFeriado, makeRemoverFeriado } from "@/main/atendimento.factory";
import { cadastrarFeriadoSchema } from "@/modules/atendimento/presentation/view-models/feriados/feriados.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function cadastrarFeriadoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = cadastrarFeriadoSchema.safeParse(input);
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
  const cadastrar = await makeCadastrarFeriado();
  return toActionResult(await cadastrar.execute(parsed.data));
}

export async function removerFeriadoAction(data: unknown): Promise<ActionResult<void>> {
  const parsed = z.iso.date().safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Data inválida." } };
  }
  const remover = await makeRemoverFeriado();
  return toActionResult(await remover.execute({ data: parsed.data }));
}

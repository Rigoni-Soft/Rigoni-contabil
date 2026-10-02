"use server";

import { z } from "zod";

import { makeTrocarSenha } from "@/main/usuarios.factory";
import { trocarSenhaSchema } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

export async function trocarSenhaAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = trocarSenhaSchema.safeParse(input);
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

  const trocarSenha = await makeTrocarSenha();
  const resultado = await trocarSenha.execute({ novaSenha: parsed.data.novaSenha });

  if (!resultado.ok) {
    return { ok: false, error: { code: resultado.error.code, message: resultado.error.message } };
  }

  return { ok: true, data: undefined };
}

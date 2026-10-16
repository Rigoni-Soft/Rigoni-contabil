"use server";

import { z } from "zod";

import { makeTrocarSenha } from "@/main/usuarios.factory";
import { trocarSenhaSchema } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

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
  return toActionResult(await trocarSenha.execute({ novaSenha: parsed.data.novaSenha }));
}

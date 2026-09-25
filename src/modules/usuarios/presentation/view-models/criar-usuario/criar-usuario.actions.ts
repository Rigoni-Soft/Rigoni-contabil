"use server";

import { z } from "zod";

import { makeCriarUsuario } from "@/main/usuarios.factory";
import type { CriarUsuarioOutput } from "@/modules/usuarios/application/ports/in/criar-usuario.provider";
import { criarUsuarioSchema } from "@/modules/usuarios/presentation/view-models/criar-usuario/criar-usuario.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

export async function criarUsuarioAction(
  input: unknown,
): Promise<ActionResult<CriarUsuarioOutput>> {
  const parsed = criarUsuarioSchema.safeParse(input);
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

  const criarUsuario = await makeCriarUsuario();
  const resultado = await criarUsuario.execute(parsed.data);

  if (!resultado.ok) {
    return { ok: false, error: { code: resultado.error.code, message: resultado.error.message } };
  }

  return { ok: true, data: resultado.value };
}

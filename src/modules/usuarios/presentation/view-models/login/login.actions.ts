"use server";

import { z } from "zod";

import { makeLogin } from "@/main/usuarios.factory";
import type { UsuarioDto } from "@/modules/usuarios/application/dtos/usuario.dto";
import { loginSchema } from "@/modules/usuarios/presentation/view-models/login/login.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function loginAction(input: unknown): Promise<ActionResult<UsuarioDto>> {
  const parsed = loginSchema.safeParse(input);
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

  const login = await makeLogin();
  return toActionResult(await login.execute(parsed.data));
}

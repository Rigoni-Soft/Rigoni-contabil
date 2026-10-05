"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDesativarUsuario } from "@/main/usuarios.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

const schema = z.object({ usuarioId: z.uuid() });

export async function desativarUsuarioAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Usuário inválido." } };
  }

  const desativarUsuario = await makeDesativarUsuario();
  const resultado = await desativarUsuario.execute(parsed.data);
  if (!resultado.ok) {
    return { ok: false, error: { code: resultado.error.code, message: resultado.error.message } };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, data: null };
}

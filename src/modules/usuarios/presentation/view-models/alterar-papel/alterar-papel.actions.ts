"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeAlterarPapelUsuario } from "@/main/usuarios.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

const schema = z.object({
  usuarioId: z.uuid(),
  papel: z.enum(["lider_setor", "funcionario"]),
});

export async function alterarPapelUsuarioAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Dados inválidos." } };
  }

  const alterarPapel = await makeAlterarPapelUsuario();
  const resultado = await alterarPapel.execute(parsed.data);
  if (!resultado.ok) {
    return { ok: false, error: { code: resultado.error.code, message: resultado.error.message } };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, data: null };
}

"use server";

import { revalidatePath } from "next/cache";

import { makeEnviarAvatar, makeRemoverAvatar } from "@/main/usuarios.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import { enviarAvatarSchema } from "./avatar.schema";

export async function enviarAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ avatarAtualizadoEm: string }>> {
  const parsed = enviarAvatarSchema.safeParse({ foto: formData.get("foto") });
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Escolha uma foto." } };
  }

  const enviarAvatar = await makeEnviarAvatar();
  const resultado = toActionResult(
    await enviarAvatar.execute({ bytes: new Uint8Array(await parsed.data.foto.arrayBuffer()) }),
  );
  if (resultado.ok) revalidatePath("/perfil");
  return resultado;
}

export async function removerAvatarAction(): Promise<ActionResult<void>> {
  const removerAvatar = await makeRemoverAvatar();
  const resultado = toActionResult(await removerAvatar.execute());
  if (resultado.ok) revalidatePath("/perfil");
  return resultado;
}

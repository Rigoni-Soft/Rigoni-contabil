"use server";

import { revalidatePath } from "next/cache";

import { makeEnviarAvatar, makeRemoverAvatar } from "@/main/usuarios.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

// O arquivo chega em um FormData (campo `foto`): a imagem já vem recortada e em WebP do navegador, e o
// caso de uso confere os bytes e o tamanho de novo (o servidor não confia no que o cliente diz).
export async function enviarAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ avatarAtualizadoEm: string }>> {
  const foto = formData.get("foto");
  if (!(foto instanceof File)) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Escolha uma foto." } };
  }

  const enviarAvatar = await makeEnviarAvatar();
  const resultado = toActionResult(
    await enviarAvatar.execute({ bytes: new Uint8Array(await foto.arrayBuffer()) }),
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

import { makeUploadDeAnexo } from "@/main/client/upload-de-anexo.factory";
import type { UploadDeAnexoPort } from "@/modules/atendimento/application/ports/out/upload-de-anexo.provider";

let upload: UploadDeAnexoPort | undefined;

export async function subirAnexoEmPartes(atendimentoId: string, arquivo: File): Promise<string> {
  upload ??= makeUploadDeAnexo();
  const subido = await upload.enviar({
    atendimentoId,
    nome: arquivo.name,
    tipoMime: arquivo.type,
    conteudo: arquivo,
  });
  if (!subido.ok) throw new Error(subido.error.message);
  return subido.value;
}

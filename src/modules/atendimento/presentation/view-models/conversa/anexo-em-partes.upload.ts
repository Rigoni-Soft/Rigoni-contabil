import { makeUploadDeAnexo } from "@/main/client/upload-de-anexo.factory";
import type { UploadDeAnexoPort } from "@/modules/atendimento/application/ports/out/upload-de-anexo.provider";

let upload: UploadDeAnexoPort | undefined;

// Sobe o arquivo em partes direto ao Storage e devolve o caminho do objeto, ou lança com a mensagem
// para a tela. Quem confere e entrega ao cliente é o servidor (`enviarAnexoGuardadoAction`).
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

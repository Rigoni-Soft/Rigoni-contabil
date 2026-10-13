// Anexo que o Funcionário envia ao cliente: o que se aceita e como se classifica. Regra de
// servidor e de formulário ao mesmo tempo (o limite de tamanho é o `serverActions.bodySizeLimit`).
export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const ANEXO_LEGENDA_TAMANHO_MAXIMO = 1024; // limite da legenda de mídia do WhatsApp

export const ANEXO_TIPO_RECUSADO =
  "Tipo de arquivo não aceito. Envie imagem (JPEG, PNG, WebP), PDF, Office, TXT, CSV ou ZIP.";

export type TipoAnexo = "imagem" | "documento";

// Por tipo MIME, nunca pela extensão. Lista fechada: SVG e HTML (que executam script) ficam de fora.
const MIME_IMAGEM = ["image/jpeg", "image/png", "image/webp"];
const MIME_DOCUMENTO = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

export const ANEXO_MIMES_ACEITOS = [...MIME_IMAGEM, ...MIME_DOCUMENTO];

// null: tipo não aceito.
export function classificarAnexo(tipoMime: string): TipoAnexo | null {
  const mime = tipoMime.split(";")[0].trim().toLowerCase();
  if (MIME_IMAGEM.includes(mime)) return "imagem";
  if (MIME_DOCUMENTO.includes(mime)) return "documento";
  return null;
}

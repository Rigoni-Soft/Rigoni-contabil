// Anexo que o Funcionário envia ao cliente: o que se aceita e como se classifica. Regra de
// servidor e de formulário ao mesmo tempo (o limite de tamanho é o `serverActions.bodySizeLimit`).
export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const ANEXO_LEGENDA_TAMANHO_MAXIMO = 1024; // limite da legenda de mídia do WhatsApp

export const ANEXO_TAMANHO_RECUSADO = "O arquivo aceita até 10 MB.";
export const ANEXO_VAZIO_RECUSADO = "O arquivo está vazio.";
export const ANEXO_TIPO_RECUSADO =
  "Tipo de arquivo não aceito. Envie imagem (JPEG, PNG, WebP), PDF, Office, TXT, CSV ou ZIP.";

// Miniatura que o formulário gera da imagem (a conversa mostra esta, não o original de até 10 MB).
export const ANEXO_MINIATURA_LADO = 320;
export const ANEXO_MINIATURA_TAMANHO_MAXIMO = 256 * 1024;
export const ANEXO_MINIATURA_NOME = "miniatura.webp";
export const ANEXO_MINIATURA_QUALIDADE = 0.8;

// Tempo antes de expirar a partir do qual a conversa pede um link novo do anexo.
export const ANEXO_LINK_MARGEM_MS = 5 * 60_000;

export type TipoAnexo = "imagem" | "documento";
// O que a Mensagem guarda: inclui o áudio (gravado pelo Funcionário, #80; enviado pelo cliente, #81).
export type TipoAnexoMensagem = TipoAnexo | "audio";

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

// Tipo e tamanho de um arquivo a enviar: a mesma regra no formulário (que antecipa a mensagem) e no
// servidor (que decide). `erro` traz a mensagem pronta para o usuário.
export function validarAnexo(
  tipoMime: string,
  bytes: number,
): { tipo: TipoAnexo; erro?: undefined } | { tipo?: undefined; erro: string } {
  const tipo = classificarAnexo(tipoMime);
  if (!tipo) return { erro: ANEXO_TIPO_RECUSADO };
  if (bytes === 0) return { erro: ANEXO_VAZIO_RECUSADO };
  if (bytes > ANEXO_TAMANHO_MAXIMO) return { erro: ANEXO_TAMANHO_RECUSADO };
  return { tipo };
}

// A miniatura é opcional: só vale se for imagem e couber no limite; senão se ignora.
export function miniaturaValida(tipoMime: string, bytes: number): boolean {
  return (
    classificarAnexo(tipoMime) === "imagem" && bytes > 0 && bytes <= ANEXO_MINIATURA_TAMANHO_MAXIMO
  );
}

// Áudio gravado pelo microfone. Não entra em `ANEXO_MIMES_ACEITOS` (o seletor de arquivos não oferece
// áudio): só a gravação o produz. A Meta aceita ogg com Opus e mp4/AAC, mas não webm.
export const AUDIO_DURACAO_MAXIMA_S = 5 * 60;
export const AUDIO_TIPO_RECUSADO = "Formato de áudio não aceito.";
export const AUDIO_MIME_OGG = "audio/ogg";
const MIME_AUDIO_NATIVO = [AUDIO_MIME_OGG, "audio/mp4"];
const MIME_AUDIO_A_CONVERTER = ["audio/webm"];

// "nativo": o provedor aceita como está; "converter": só depois de virar ogg/opus; null: recusado.
export function classificarAudio(tipoMime: string): "nativo" | "converter" | null {
  const mime = tipoMime.split(";")[0].trim().toLowerCase();
  if (MIME_AUDIO_NATIVO.includes(mime)) return "nativo";
  if (MIME_AUDIO_A_CONVERTER.includes(mime)) return "converter";
  return null;
}

export function ehAudio(tipoMime: string): boolean {
  return tipoMime.trim().toLowerCase().startsWith("audio/");
}

export function validarAudio(
  tipoMime: string,
  bytes: number,
): { formato: "nativo" | "converter"; erro?: undefined } | { formato?: undefined; erro: string } {
  const formato = classificarAudio(tipoMime);
  if (!formato) return { erro: AUDIO_TIPO_RECUSADO };
  if (bytes === 0) return { erro: ANEXO_VAZIO_RECUSADO };
  if (bytes > ANEXO_TAMANHO_MAXIMO) return { erro: ANEXO_TAMANHO_RECUSADO };
  return { formato };
}

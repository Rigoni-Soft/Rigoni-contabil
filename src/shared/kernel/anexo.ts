export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const ANEXO_LEGENDA_TAMANHO_MAXIMO = 1024;

export const ANEXO_TAMANHO_RECUSADO = "O arquivo aceita até 10 MB.";
export const ANEXO_VAZIO_RECUSADO = "O arquivo está vazio.";
export const ANEXO_TIPO_RECUSADO =
  "Tipo de arquivo não aceito. Envie imagem (JPEG, PNG, WebP), PDF, Office, TXT, CSV ou ZIP.";

export const ANEXO_MINIATURA_LADO = 320;
export const ANEXO_MINIATURA_TAMANHO_MAXIMO = 256 * 1024;
export const ANEXO_MINIATURA_NOME = "miniatura.webp";
export const ANEXO_MINIATURA_QUALIDADE = 0.8;

export const ANEXO_LINK_MARGEM_MS = 5 * 60_000;

export type TipoAnexo = "imagem" | "documento";
export type TipoAnexoMensagem = TipoAnexo | "audio";

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

export function normalizarMime(tipoMime: string): string {
  return tipoMime.split(";")[0].trim().toLowerCase();
}

export function classificarAnexo(tipoMime: string): TipoAnexo | null {
  const mime = normalizarMime(tipoMime);
  if (MIME_IMAGEM.includes(mime)) return "imagem";
  if (MIME_DOCUMENTO.includes(mime)) return "documento";
  return null;
}

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

export function miniaturaValida(tipoMime: string, bytes: number): boolean {
  return (
    classificarAnexo(tipoMime) === "imagem" && bytes > 0 && bytes <= ANEXO_MINIATURA_TAMANHO_MAXIMO
  );
}

export const AUDIO_DURACAO_MAXIMA_S = 5 * 60;
export const AUDIO_TIPO_RECUSADO = "Formato de áudio não aceito.";
export const AUDIO_MIME_OGG = "audio/ogg";
const MIME_AUDIO_NATIVO = [AUDIO_MIME_OGG, "audio/mp4"];
const MIME_AUDIO_A_CONVERTER = ["audio/webm"];

export function classificarAudio(tipoMime: string): "nativo" | "converter" | null {
  const mime = normalizarMime(tipoMime);
  if (MIME_AUDIO_NATIVO.includes(mime)) return "nativo";
  if (MIME_AUDIO_A_CONVERTER.includes(mime)) return "converter";
  return null;
}

export const AUDIO_OGG_SEM_OPUS_RECUSADO = "O áudio em ogg precisa usar o codec Opus.";
export const AUDIO_CABECALHO_BYTES = 128;

const MARCA_DO_CODEC_OPUS = "OpusHead";

export function ehOggOpus(inicio: Uint8Array): boolean {
  const marca = Array.from(MARCA_DO_CODEC_OPUS, (c) => c.charCodeAt(0));
  const fim = Math.min(inicio.length, AUDIO_CABECALHO_BYTES) - marca.length;
  for (let i = 0; i <= fim; i++) {
    if (marca.every((byte, j) => inicio[i + j] === byte)) return true;
  }
  return false;
}

export type PreviaDeAnexo = "navegador" | "docx" | "xlsx";
export type FormatoDeOffice = Exclude<PreviaDeAnexo, "navegador">;

export function tipoDePrevia(nome: string): PreviaDeAnexo | null {
  const extensao = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extensao === "pdf" || extensao === "txt") return "navegador";
  if (extensao === "docx" || extensao === "xlsx") return extensao;
  return null;
}

export function ehAudio(tipoMime: string): boolean {
  return normalizarMime(tipoMime).startsWith("audio/");
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

export function validarMidiaRecebida(
  tipoMime: string,
  bytes: number,
): { tipo: TipoAnexoMensagem; erro?: undefined } | { tipo?: undefined; erro: string } {
  if (!ehAudio(tipoMime)) return validarAnexo(tipoMime, bytes);
  const audio = validarAudio(tipoMime, bytes);
  if (audio.erro !== undefined) return { erro: audio.erro };
  return audio.formato === "nativo" ? { tipo: "audio" } : { erro: AUDIO_TIPO_RECUSADO };
}

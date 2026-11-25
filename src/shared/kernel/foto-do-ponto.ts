export const LIMITE_DA_FOTO_BYTES = 4 * 1024 * 1024;

export type TipoDeFoto = "image/jpeg" | "image/png";
export type FotoDoPonto = { bytes: Uint8Array; tipo: TipoDeFoto };

const ASSINATURA_JPEG = [0xff, 0xd8, 0xff];
const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const comecaCom = (bytes: Uint8Array, assinatura: number[]) =>
  assinatura.every((byte, posicao) => bytes[posicao] === byte);

export function tipoDaFoto(bytes: Uint8Array): TipoDeFoto | null {
  if (comecaCom(bytes, ASSINATURA_JPEG)) return "image/jpeg";
  if (comecaCom(bytes, ASSINATURA_PNG)) return "image/png";
  return null;
}

export function ehFotoValida({ bytes, tipo }: FotoDoPonto): boolean {
  if (bytes.length === 0 || bytes.length > LIMITE_DA_FOTO_BYTES) return false;
  return tipoDaFoto(bytes) === tipo;
}

import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export const LIMITE_AVATAR_BYTES = 256 * 1024;

export class ImagemAvatar {
  private constructor(private readonly props: { bytes: Uint8Array }) {}

  static criar(bytes: Uint8Array): Result<ImagemAvatar, ValidationError> {
    if (bytes.byteLength === 0) return err(new ValidationError("Escolha uma imagem."));
    if (bytes.byteLength > LIMITE_AVATAR_BYTES) {
      return err(new ValidationError("A imagem passa de 256 KB."));
    }
    if (!ehWebp(bytes)) return err(new ValidationError("A imagem não está em formato WebP."));
    return ok(new ImagemAvatar({ bytes }));
  }

  get bytes(): Uint8Array {
    return this.props.bytes;
  }
}

function ehWebp(bytes: Uint8Array): boolean {
  const texto = (inicio: number, fim: number) =>
    String.fromCharCode(...bytes.subarray(inicio, fim));
  return bytes.byteLength >= 12 && texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP";
}

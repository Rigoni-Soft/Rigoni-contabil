import {
  ImagemAvatar,
  LIMITE_AVATAR_BYTES,
} from "@/modules/usuarios/domain/value-objects/imagem-avatar.vo";

const ascii = (texto: string) => [...Buffer.from(texto, "ascii")];

function webp(tamanho: number): Uint8Array {
  const bytes = new Uint8Array(tamanho);
  bytes.set(ascii("RIFF"), 0);
  bytes.set(ascii("WEBP"), 8);
  return bytes;
}

describe("ImagemAvatar", () => {
  it("aceita WebP até 256 KB", () => {
    expect(ImagemAvatar.criar(webp(LIMITE_AVATAR_BYTES)).ok).toBe(true);
  });

  it("recusa mais de 256 KB", () => {
    const r = ImagemAvatar.criar(webp(LIMITE_AVATAR_BYTES + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/256 KB/);
  });

  it("recusa vazio", () => {
    expect(ImagemAvatar.criar(new Uint8Array()).ok).toBe(false);
  });

  it.each([
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]],
    ["JPEG", [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["RIFF que não é WebP (WAV)", [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]],
    ["curto demais", ascii("RIFF")],
  ])("recusa %s pelos bytes", (_nome, bytes) => {
    expect(ImagemAvatar.criar(new Uint8Array(bytes)).ok).toBe(false);
  });
});

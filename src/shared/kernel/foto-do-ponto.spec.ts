import { ehFotoValida, LIMITE_DA_FOTO_BYTES, tipoDaFoto } from "@/shared/kernel/foto-do-ponto";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bytes = (...partes: number[][]) => new Uint8Array(partes.flat());

describe("tipoDaFoto", () => {
  it("reconhece JPEG e PNG pela assinatura completa do arquivo", () => {
    expect(tipoDaFoto(bytes(JPEG))).toBe("image/jpeg");
    expect(tipoDaFoto(bytes(PNG, [0, 0]))).toBe("image/png");
  });

  it.each([
    ["só os 2 primeiros bytes do JPEG", bytes([0xff, 0xd8])],
    ["só os 2 primeiros bytes do PNG", bytes([0x89, 0x50])],
    ["PNG com a assinatura quebrada", bytes([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])],
    ["PDF", bytes([0x25, 0x50, 0x44, 0x46])],
    ["vazio", bytes()],
  ])("não é foto: %s", (_, conteudo) => {
    expect(tipoDaFoto(conteudo)).toBeNull();
  });
});

describe("ehFotoValida", () => {
  it("aceita a foto cujo tipo declarado é o do arquivo", () => {
    expect(ehFotoValida({ bytes: bytes(JPEG), tipo: "image/jpeg" })).toBe(true);
    expect(ehFotoValida({ bytes: bytes(PNG), tipo: "image/png" })).toBe(true);
  });

  it("recusa o arquivo que não é do tipo que diz ser (o File.type do navegador não vale)", () => {
    expect(ehFotoValida({ bytes: bytes([0x25, 0x50, 0x44, 0x46]), tipo: "image/jpeg" })).toBe(
      false,
    );
    expect(ehFotoValida({ bytes: bytes(JPEG), tipo: "image/png" })).toBe(false);
  });

  it("recusa vazio e o que passa do limite", () => {
    expect(ehFotoValida({ bytes: bytes(), tipo: "image/jpeg" })).toBe(false);
    const grande = new Uint8Array(LIMITE_DA_FOTO_BYTES + 1);
    grande.set(JPEG);
    expect(ehFotoValida({ bytes: grande, tipo: "image/jpeg" })).toBe(false);
    const noLimite = new Uint8Array(LIMITE_DA_FOTO_BYTES);
    noLimite.set(JPEG);
    expect(ehFotoValida({ bytes: noLimite, tipo: "image/jpeg" })).toBe(true);
  });
});

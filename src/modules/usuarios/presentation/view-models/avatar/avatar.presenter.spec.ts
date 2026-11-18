import { avisoDaFoto, LIMITE_DA_FOTO_BYTES } from "./avatar.presenter";

describe("avisoDaFoto", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("aceita %s", (type) => {
    expect(avisoDaFoto({ type, size: 1024 })).toBeUndefined();
  });

  it("aceita exatamente 5 MB", () => {
    expect(avisoDaFoto({ type: "image/png", size: LIMITE_DA_FOTO_BYTES })).toBeUndefined();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("avisa do formato %p", (type) => {
    expect(avisoDaFoto({ type, size: 1024 })).toMatch(/JPEG, PNG ou WebP/);
  });

  it("avisa do tamanho acima de 5 MB", () => {
    expect(avisoDaFoto({ type: "image/jpeg", size: LIMITE_DA_FOTO_BYTES + 1 })).toMatch(/5 MB/);
  });
});

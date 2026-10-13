import { ANEXO_MIMES_ACEITOS, classificarAnexo } from "./anexo";

describe("classificarAnexo", () => {
  it.each([
    ["image/jpeg", "imagem"],
    ["image/png", "imagem"],
    ["image/webp", "imagem"],
    ["application/pdf", "documento"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "documento"],
    ["text/csv", "documento"],
    ["application/zip", "documento"],
    ["IMAGE/PNG; charset=binary", "imagem"],
  ])("%s é %s", (mime, tipo) => {
    expect(classificarAnexo(mime)).toBe(tipo);
  });

  it.each(["image/svg+xml", "text/html", "application/javascript", "image/gif", "", "audio/ogg"])(
    "recusa %p",
    (mime) => {
      expect(classificarAnexo(mime)).toBeNull();
    },
  );

  it("a lista aceita é exatamente o que classifica", () => {
    expect(ANEXO_MIMES_ACEITOS.every((m) => classificarAnexo(m) !== null)).toBe(true);
  });
});

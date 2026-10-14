import {
  ANEXO_MIMES_ACEITOS,
  ANEXO_TAMANHO_MAXIMO,
  ANEXO_TAMANHO_RECUSADO,
  ANEXO_TIPO_RECUSADO,
  ANEXO_VAZIO_RECUSADO,
  AUDIO_TIPO_RECUSADO,
  classificarAnexo,
  classificarAudio,
  miniaturaValida,
  validarAnexo,
  validarAudio,
} from "./anexo";

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

describe("validarAnexo", () => {
  it("aceita tipo conhecido dentro do limite", () => {
    expect(validarAnexo("application/pdf", 10)).toEqual({ tipo: "documento" });
  });

  it.each([
    ["image/svg+xml", 10, ANEXO_TIPO_RECUSADO],
    ["application/pdf", 0, ANEXO_VAZIO_RECUSADO],
    ["application/pdf", ANEXO_TAMANHO_MAXIMO + 1, ANEXO_TAMANHO_RECUSADO],
  ])("recusa %s com %d bytes", (mime, bytes, erro) => {
    expect(validarAnexo(mime, bytes)).toEqual({ erro });
  });
});

describe("miniaturaValida", () => {
  it("só imagem não vazia dentro do limite", () => {
    expect(miniaturaValida("image/webp", 100)).toBe(true);
    expect(miniaturaValida("application/pdf", 100)).toBe(false);
    expect(miniaturaValida("image/webp", 0)).toBe(false);
    expect(miniaturaValida("image/webp", 10 * 1024 * 1024)).toBe(false);
  });
});

describe("áudio gravado", () => {
  it.each([
    ["audio/ogg;codecs=opus", "nativo"],
    ["audio/mp4;codecs=mp4a.40.2", "nativo"],
    ["audio/mp4", "nativo"],
    ["audio/webm;codecs=opus", "converter"],
    ["audio/mpeg", null],
    ["image/png", null],
  ])("%s é %s", (mime, formato) => {
    expect(classificarAudio(mime)).toBe(formato);
  });

  it("valida formato e tamanho", () => {
    expect(validarAudio("audio/webm", 10)).toEqual({ formato: "converter" });
    expect(validarAudio("audio/mpeg", 10)).toEqual({ erro: AUDIO_TIPO_RECUSADO });
    expect(validarAudio("audio/ogg", 0)).toEqual({ erro: ANEXO_VAZIO_RECUSADO });
    expect(validarAudio("audio/ogg", ANEXO_TAMANHO_MAXIMO + 1)).toEqual({
      erro: ANEXO_TAMANHO_RECUSADO,
    });
  });
});

import {
  ANEXO_MIMES_ACEITOS,
  ANEXO_TAMANHO_MAXIMO,
  ANEXO_TAMANHO_RECUSADO,
  ANEXO_TIPO_RECUSADO,
  ANEXO_VAZIO_RECUSADO,
  AUDIO_TIPO_RECUSADO,
  classificarAnexo,
  classificarAudio,
  ehOggOpus,
  miniaturaValida,
  tipoDePrevia,
  validarAnexo,
  validarAudio,
  validarMidiaRecebida,
} from "./anexo";

describe("tipoDePrevia", () => {
  it.each([
    ["balanco.pdf", "navegador"],
    ["LEIA-ME.TXT", "navegador"],
    ["contrato.docx", "docx"],
    ["Balancete.XLSX", "xlsx"],
    ["antigo.doc", null],
    ["planilha.xls", null],
    ["apresentacao.pptx", null],
    ["sem-extensao", null],
  ])("%s → %s", (nome, esperado) => {
    expect(tipoDePrevia(nome)).toBe(esperado);
  });
});

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

describe("ehOggOpus", () => {
  const com = (texto: string) => Uint8Array.from(`OggS....${texto}`, (c) => c.charCodeAt(0));

  it("reconhece Opus pelo cabeçalho e recusa Vorbis", () => {
    expect(ehOggOpus(com("OpusHead"))).toBe(true);
    expect(ehOggOpus(com("vorbis"))).toBe(false);
    expect(ehOggOpus(new Uint8Array(0))).toBe(false);
  });
});

describe("validarMidiaRecebida (mídia que o cliente envia)", () => {
  it.each([
    ["audio/ogg; codecs=opus", "audio"],
    ["audio/mp4", "audio"],
    ["image/jpeg", "imagem"],
    ["application/pdf", "documento"],
  ])("%s é aceito como %s", (mime, tipo) => {
    expect(validarMidiaRecebida(mime, 1024)).toEqual({ tipo });
  });

  it.each([
    ["image/svg+xml", ANEXO_TIPO_RECUSADO],
    ["text/html", ANEXO_TIPO_RECUSADO],
    ["audio/webm", AUDIO_TIPO_RECUSADO],
  ])("%s é recusado", (mime, erro) => {
    expect(validarMidiaRecebida(mime, 1024)).toEqual({ erro });
  });

  it("recusa vazio e acima de 10 MB, em áudio e em arquivo", () => {
    expect(validarMidiaRecebida("audio/ogg", 0)).toEqual({ erro: ANEXO_VAZIO_RECUSADO });
    expect(validarMidiaRecebida("image/png", ANEXO_TAMANHO_MAXIMO + 1)).toEqual({
      erro: ANEXO_TAMANHO_RECUSADO,
    });
  });
});

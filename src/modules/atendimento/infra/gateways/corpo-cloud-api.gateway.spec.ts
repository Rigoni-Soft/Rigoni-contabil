import { envelope, parteAnexo, parteReacao, parteTemplate } from "./corpo-cloud-api.gateway";

describe("corpo da WhatsApp Cloud API", () => {
  it("envelope acrescenta o produto e o tipo de destinatário", () => {
    expect(envelope({ to: "5511", type: "text", text: { body: "oi" } })).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511",
      type: "text",
      text: { body: "oi" },
    });
  });

  describe("parteTemplate", () => {
    it("sem documento, só o corpo com as variáveis em ordem", () => {
      expect(
        parteTemplate({
          telefone: "5511",
          nome: "lembrete",
          idioma: "pt_BR",
          variaveis: ["a", "b"],
        }),
      ).toEqual({
        to: "5511",
        type: "template",
        template: {
          name: "lembrete",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "a" },
                { type: "text", text: "b" },
              ],
            },
          ],
        },
      });
    });

    it("com documento, o cabeçalho vem antes do corpo", () => {
      const parte = parteTemplate({
        telefone: "5511",
        nome: "guia",
        idioma: "pt_BR",
        variaveis: [],
        documento: { url: "https://x/g.pdf", nomeArquivo: "g.pdf" },
      });

      expect(parte).toMatchObject({
        template: {
          components: [
            {
              type: "header",
              parameters: [
                { type: "document", document: { link: "https://x/g.pdf", filename: "g.pdf" } },
              ],
            },
            { type: "body", parameters: [] },
          ],
        },
      });
    });
  });

  describe("parteAnexo", () => {
    const base = { telefone: "5511", url: "https://x/a", nomeArquivo: "a.pdf" };

    it("imagem leva legenda", () => {
      expect(parteAnexo({ ...base, tipo: "imagem", legenda: "foto" })).toEqual({
        to: "5511",
        type: "image",
        image: { link: "https://x/a", caption: "foto" },
      });
    });

    it("áudio nunca leva legenda", () => {
      expect(parteAnexo({ ...base, tipo: "audio", legenda: "ignorada" })).toEqual({
        to: "5511",
        type: "audio",
        audio: { link: "https://x/a" },
      });
    });

    it("documento leva nome do arquivo e legenda opcional", () => {
      expect(parteAnexo({ ...base, tipo: "documento" })).toEqual({
        to: "5511",
        type: "document",
        document: { link: "https://x/a", filename: "a.pdf" },
      });
      expect(parteAnexo({ ...base, tipo: "documento", legenda: "veja" })).toMatchObject({
        document: { caption: "veja" },
      });
    });
  });

  it("parteReacao mapeia o id externo e o emoji", () => {
    expect(parteReacao({ telefone: "5511", idExterno: "wamid.1", emoji: "👍" })).toEqual({
      to: "5511",
      type: "reaction",
      reaction: { message_id: "wamid.1", emoji: "👍" },
    });
  });
});

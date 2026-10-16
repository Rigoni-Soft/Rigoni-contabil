import { EnvioMensagemWhatsappGateway } from "./envio-mensagem-whatsapp.gateway";

const resposta = (status: number, corpo: unknown) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});
const responde = (status: number, corpo: unknown = {}) =>
  jest.fn(async () => resposta(status, corpo));
const gateway = (http: unknown) =>
  new EnvioMensagemWhatsappGateway("tok", "123", http as typeof fetch);
const chamada = (http: jest.Mock, i = 0) => {
  const [url, init] = http.mock.calls[i] as unknown as [string, RequestInit];
  return { url, init, corpo: JSON.parse(init.body as string) };
};

describe("EnvioMensagemWhatsappGateway", () => {
  it("envia texto no formato da Cloud API com bearer", async () => {
    const http = responde(200);
    const r = await gateway(http).enviar({ telefone: "5511999990000", texto: "oi" });

    const { url, init, corpo } = chamada(http);
    expect(r.ok).toBe(true);
    expect(url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(corpo).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511999990000",
      type: "text",
      text: { body: "oi" },
    });
  });

  it("documento por url vai como link", async () => {
    const http = responde(200);
    await gateway(http).enviarDocumento({
      telefone: "55",
      nomeArquivo: "g.pdf",
      url: "https://x/g.pdf",
    });
    expect(chamada(http).corpo.document).toEqual({ link: "https://x/g.pdf", filename: "g.pdf" });
  });

  it("documento em base64 sobe a mídia e envia pelo id", async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce(resposta(200, { id: "m1" }))
      .mockResolvedValueOnce(resposta(200, {}));
    const r = await gateway(http).enviarDocumento({
      telefone: "55",
      nomeArquivo: "g.pdf",
      pdfBase64: Buffer.from("pdf").toString("base64"),
    });

    expect(r.ok).toBe(true);
    expect((http.mock.calls[0] as unknown[])[0]).toBe("https://graph.facebook.com/v21.0/123/media");
    expect(chamada(http, 1).corpo.document).toEqual({ id: "m1", filename: "g.pdf" });
  });

  it("template leva cabeçalho de documento e variáveis na ordem", async () => {
    const http = responde(200);
    await gateway(http).enviarTemplate({
      telefone: "55",
      nome: "envio_guia_das",
      idioma: "pt_BR",
      variaveis: ["Ana", "10/2026"],
      documento: { url: "https://x/g.pdf", nomeArquivo: "g.pdf" },
    });
    expect(chamada(http).corpo.template).toEqual({
      name: "envio_guia_das",
      language: { code: "pt_BR" },
      components: [
        {
          type: "header",
          parameters: [
            { type: "document", document: { link: "https://x/g.pdf", filename: "g.pdf" } },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: "Ana" },
            { type: "text", text: "10/2026" },
          ],
        },
      ],
    });
  });

  it("anexo de imagem leva legenda; áudio não tem legenda", async () => {
    const http = responde(200);
    const base = { telefone: "55", url: "https://x/a", nomeArquivo: "a" };
    await gateway(http).enviarAnexo({ ...base, tipo: "imagem", legenda: "oi" });
    await gateway(http).enviarAnexo({ ...base, tipo: "audio", legenda: "ignorada" });
    expect(chamada(http, 0).corpo.image).toEqual({ link: "https://x/a", caption: "oi" });
    expect(chamada(http, 1).corpo.audio).toEqual({ link: "https://x/a" });
  });

  it("reação envia o id externo e o emoji", async () => {
    const http = responde(200);
    await gateway(http).reagir({ telefone: "55", idExterno: "wamid.X", emoji: "👍" });
    expect(chamada(http).corpo.reaction).toEqual({ message_id: "wamid.X", emoji: "👍" });
  });

  it("400 vira ValidationError com o código da Meta", async () => {
    const http = responde(400, { error: { code: 133010, message: "Not Registered" } });
    const r = await gateway(http).enviar({ telefone: "55", texto: "oi" });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(!r.ok && r.error.message).toContain("133010");
  });

  it.each([401, 429, 500])("%i vira ServicoExternoError", async (status) => {
    const r = await gateway(responde(status)).enviar({ telefone: "55", texto: "oi" });
    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("falha de rede vira ServicoExternoError", async () => {
    const http = jest.fn(async () => {
      throw new Error("rede");
    });
    const r = await gateway(http).enviar({ telefone: "55", texto: "oi" });
    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });
});

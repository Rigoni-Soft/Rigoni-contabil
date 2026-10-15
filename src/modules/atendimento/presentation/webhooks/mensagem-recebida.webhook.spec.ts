import { classificarMensagem, mensagemSchema } from "./mensagem-recebida.webhook";

const classificar = (mensagem: object) =>
  classificarMensagem(mensagemSchema.parse({ from: "5511912345678", id: "wamid.1", ...mensagem }));

describe("classificarMensagem (payload da Cloud API por tipo)", () => {
  it("texto", () => {
    expect(classificar({ type: "text", text: { body: "oi" } })).toEqual({
      tipo: "texto",
      telefone: "5511912345678",
      texto: "oi",
      id: "wamid.1",
    });
  });

  it("áudio (inclusive mensagem de voz): id da mídia e MIME, sem legenda", () => {
    expect(
      classificar({
        type: "audio",
        audio: { id: "mid-1", mime_type: "audio/ogg; codecs=opus", voice: true },
      }),
    ).toEqual({
      tipo: "midia",
      telefone: "5511912345678",
      id: "wamid.1",
      midia: { id: "mid-1", mime: "audio/ogg; codecs=opus", nome: undefined },
      legenda: undefined,
    });
  });

  it("imagem: MIME e legenda", () => {
    expect(
      classificar({
        type: "image",
        image: { id: "mid-2", mime_type: "image/jpeg", caption: "o recibo" },
      }),
    ).toMatchObject({
      tipo: "midia",
      midia: { id: "mid-2", mime: "image/jpeg" },
      legenda: "o recibo",
    });
  });

  it("documento: nome do arquivo, MIME e legenda", () => {
    expect(
      classificar({
        type: "document",
        document: {
          id: "mid-3",
          mime_type: "application/pdf",
          filename: "balanco.pdf",
          caption: "segue",
        },
      }),
    ).toMatchObject({
      tipo: "midia",
      midia: { id: "mid-3", mime: "application/pdf", nome: "balanco.pdf" },
      legenda: "segue",
    });
  });

  it.each([
    ["figurinha", { type: "sticker", sticker: { id: "s" } }],
    ["áudio sem id de mídia", { type: "audio", audio: {} }],
    ["tipo sem objeto", { type: "audio" }],
  ])("%s segue como texto vazio (reabre o menu)", (_, mensagem) => {
    expect(classificar(mensagem)).toMatchObject({ tipo: "texto", texto: "" });
  });

  it("id da mensagem vazio vira ausente", () => {
    expect(classificar({ id: "", type: "text", text: { body: "oi" } })).toMatchObject({
      id: undefined,
    });
  });
});

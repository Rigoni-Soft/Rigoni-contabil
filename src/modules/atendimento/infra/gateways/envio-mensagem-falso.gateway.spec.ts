import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";

import { EnvioMensagemFalsoGateway } from "./envio-mensagem-falso.gateway";

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("EnvioMensagemFalsoGateway (Cloud API simulada)", () => {
  it("monta o corpo de envio no formato da Cloud API e registra a mensagem", async () => {
    const gateway = new EnvioMensagemFalsoGateway();
    const r = await gateway.enviar({ telefone: "5511912345678", texto: "oi" });
    expect(r.ok).toBe(true);
    expect(gateway.requisicoes[0]).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511912345678",
      type: "text",
      text: { body: "oi" },
    });
    expect(gateway.enviadas).toEqual([{ telefone: "5511912345678", texto: "oi" }]);
  });

  it.each([
    [133010, ValidationError], // 400: número não registrado no WhatsApp
    [131047, ValidationError], // 400: fora da janela de 24h
    [131026, ValidationError], // 400: entrega falhou
    [130429, ServicoExternoError], // 429: throughput
    [190, ServicoExternoError], // 401: token expirado
    [131000, ServicoExternoError], // 500: erro desconhecido
  ])(
    "erro %i da Cloud API vira o erro de domínio certo e não registra envio",
    async (code, tipo) => {
      const gateway = new EnvioMensagemFalsoGateway({ "5511900000000": code });
      const r = await gateway.enviar({ telefone: "5511900000000", texto: "oi" });
      expect(r).toEqual({ ok: false, error: expect.any(tipo) });
      expect(gateway.enviadas).toHaveLength(0);
    },
  );

  it("monta o corpo de envio de documento no formato da Cloud API e registra o envio", async () => {
    const gateway = new EnvioMensagemFalsoGateway();
    const documento = {
      telefone: "5511912345678",
      url: "https://storage.test/contrato.pdf",
      nomeArquivo: "Contrato social.pdf",
    };
    const r = await gateway.enviarDocumento(documento);
    expect(r.ok).toBe(true);
    expect(gateway.requisicoes[0]).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511912345678",
      type: "document",
      document: { link: documento.url, filename: documento.nomeArquivo },
    });
    expect(gateway.documentosEnviados).toEqual([documento]);
  });

  it("erro da Cloud API no envio de documento não registra o envio", async () => {
    const gateway = new EnvioMensagemFalsoGateway({ "5511900000000": 133010 });
    const r = await gateway.enviarDocumento({
      telefone: "5511900000000",
      url: "https://storage.test/x.pdf",
      nomeArquivo: "x.pdf",
    });
    expect(r).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(gateway.documentosEnviados).toHaveLength(0);
  });
});

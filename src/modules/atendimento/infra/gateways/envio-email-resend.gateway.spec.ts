import { EnvioEmailResendGateway } from "./envio-email-resend.gateway";

// jsdom não tem `Response`: o gateway só usa ok/status.
const resposta = (status: number) => ({ ok: status < 300, status });
const AGORA = () => new Date("2026-10-16T15:00:00Z");
const EMAIL = {
  para: "cliente@empresa.com.br",
  assunto: "Guia do DAS",
  texto: "Segue a guia.",
  anexo: { url: "https://storage.test/das.pdf", nomeArquivo: "das.pdf" },
};

function gateway(http: jest.Mock) {
  return new EnvioEmailResendGateway("re_chave", "Rigoni <no-reply@rigoni.test>", http, AGORA);
}

describe("EnvioEmailResendGateway", () => {
  it("envia assunto, texto e o anexo pela URL, com chave de idempotência estável no dia", async () => {
    const http = jest.fn().mockResolvedValue(resposta(200));

    const r = await gateway(http).enviar(EMAIL);
    await gateway(http).enviar(EMAIL);

    expect(r.ok).toBe(true);
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_chave");
    expect(JSON.parse(init.body)).toEqual({
      from: "Rigoni <no-reply@rigoni.test>",
      to: ["cliente@empresa.com.br"],
      subject: "Guia do DAS",
      text: "Segue a guia.",
      attachments: [{ path: "https://storage.test/das.pdf", filename: "das.pdf" }],
    });
    expect(http.mock.calls[1][1].headers["Idempotency-Key"]).toBe(init.headers["Idempotency-Key"]);
  });

  it("sem anexo não manda attachments", async () => {
    const http = jest.fn().mockResolvedValue(resposta(200));

    await gateway(http).enviar({ para: EMAIL.para, assunto: "Lembrete", texto: "Oi" });

    expect(JSON.parse(http.mock.calls[0][1].body)).not.toHaveProperty("attachments");
  });

  it("400/422 é ValidationError; 429, 5xx e rede são ServicoExternoError", async () => {
    const codigos = async (http: jest.Mock) => {
      const r = await gateway(http).enviar(EMAIL);
      return !r.ok && r.error.code;
    };

    expect(await codigos(jest.fn().mockResolvedValue(resposta(422)))).toBe("VALIDATION_ERROR");
    expect(await codigos(jest.fn().mockResolvedValue(resposta(400)))).toBe("VALIDATION_ERROR");
    expect(await codigos(jest.fn().mockResolvedValue(resposta(429)))).toBe(
      "EXTERNAL_SERVICE_ERROR",
    );
    expect(await codigos(jest.fn().mockResolvedValue(resposta(503)))).toBe(
      "EXTERNAL_SERVICE_ERROR",
    );
    expect(await codigos(jest.fn().mockRejectedValue(new Error("ECONNREFUSED")))).toBe(
      "EXTERNAL_SERVICE_ERROR",
    );
  });
});

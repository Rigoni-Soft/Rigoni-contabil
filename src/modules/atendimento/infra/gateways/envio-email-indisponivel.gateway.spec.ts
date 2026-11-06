import { EnvioEmailIndisponivelGateway } from "./envio-email-indisponivel.gateway";

describe("EnvioEmailIndisponivelGateway", () => {
  it("falha de forma explícita e não transitória, sem fingir o envio", async () => {
    const resultado = await new EnvioEmailIndisponivelGateway().enviar({
      para: "ana@3a.com.br",
      assunto: "Guia do DAS",
      texto: "texto",
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
  });
});

import { ObrigacoesFiscaisHttpGateway } from "./obrigacoes-fiscais-http.gateway";

// jsdom não tem `Response`: o gateway só usa ok/status/json.
const json = (corpo: unknown, status = 200) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});
const URL_BASE = "http://fontes.test";

describe("ObrigacoesFiscaisHttpGateway", () => {
  it("lê o DAS do contrato neutro no recurso do CNPJ", async () => {
    const http = jest.fn().mockResolvedValue(
      json({
        nomeArquivo: "das.pdf",
        pdfBase64: "JVBERg==",
        competencia: "2026-09",
        valorCentavos: 100,
        vencimento: "2026-10-20",
      }),
    );

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarDas("11444777000161");

    expect(http.mock.calls[0][0]).toBe(`${URL_BASE}/clientes/11444777000161/das`);
    expect(r.ok && r.value.valorCentavos).toBe(100);
  });

  it("autorização ausente é resposta válida, não erro", async () => {
    const http = jest.fn().mockResolvedValue(json({ vigente: false }));

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).consultarAutorizacao("1");

    expect(r.ok && r.value.vigente).toBe(false);
  });

  it("status não-2xx vira ServicoExternoError", async () => {
    const http = jest.fn().mockResolvedValue(json({}, 503));

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarDas("1");

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("corpo fora do contrato vira ServicoExternoError", async () => {
    const http = jest.fn().mockResolvedValue(json({ qualquer: "coisa" }));

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiaParcelamento("1");

    expect(!r.ok && r.error.message).toMatch(/fora do contrato/);
  });

  it("falha de rede vira ServicoExternoError, sem lançar", async () => {
    const http = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarDas("1");

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });
});

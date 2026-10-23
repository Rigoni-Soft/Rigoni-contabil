import { ObrigacoesFiscaisHttpGateway } from "./obrigacoes-fiscais-http.gateway";

// jsdom não tem `Response`: o gateway só usa ok/status/json.
const json = (corpo: unknown, status = 200) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});
const URL_BASE = "http://fontes.test";
const PEDIDO = { regime: "simples_nacional" as const, ignorar: [] as string[] };

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

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiasParcelamento(
      "1",
      PEDIDO,
    );

    expect(!r.ok && r.error.message).toMatch(/fora do contrato/);
  });

  it("falha de rede vira ServicoExternoError, sem lançar", async () => {
    const http = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarDas("1");

    expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  describe("guias de parcelamento", () => {
    const guia = (parcela: string) => ({
      nomeArquivo: `p-${parcela}.pdf`,
      pdfBase64: "JVBERg==",
      parcela,
    });

    it("pede GET /clientes/{cnpj}/parcelamentos e lê as guias, 0, 1 ou várias", async () => {
      for (const guias of [[], [guia("202609")], [guia("202608"), guia("202609")]]) {
        const http = jest.fn().mockResolvedValue(json({ guias }));

        const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiasParcelamento(
          "11444777000161",
          PEDIDO,
        );

        expect(http.mock.calls[0][0]).toBe(`${URL_BASE}/clientes/11444777000161/parcelamentos`);
        expect(r.ok && r.value).toEqual(guias);
      }
    });

    it("manda as parcelas já entregues em ?ignorar=, para o provedor não emitir de novo", async () => {
      const http = jest.fn().mockResolvedValue(json({ guias: [] }));

      await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiasParcelamento("1", {
        ...PEDIDO,
        ignorar: ["202608", "202609"],
      });

      expect(http.mock.calls[0][0]).toBe(
        `${URL_BASE}/clientes/1/parcelamentos?ignorar=202608,202609`,
      );
    });

    it("guia com parcela fora do formato é corpo fora do contrato", async () => {
      const http = jest.fn().mockResolvedValue(json({ guias: [guia("setembro")] }));

      const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiasParcelamento(
        "1",
        PEDIDO,
      );

      expect(!r.ok && r.error.message).toMatch(/fora do contrato/);
    });
  });
});

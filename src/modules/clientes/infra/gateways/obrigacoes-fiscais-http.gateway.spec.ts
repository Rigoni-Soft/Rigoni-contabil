import { GuiaParcelamentoIndisponivelError } from "@/shared/errors/guia-parcelamento-indisponivel.error";

import { ObrigacoesFiscaisHttpGateway } from "./obrigacoes-fiscais-http.gateway";

// jsdom não tem `Response`: o gateway só usa ok/status/json.
const json = (corpo: unknown, status = 200) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});
const URL_BASE = "http://fontes.test";
const PEDIDO = {
  codigo: "PARC-AB12/34",
  regime: "simples_nacional" as const,
  emAbertoDaReceita: 1,
};

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

    const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiaParcelamento(
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

  describe("guia por código de parcelamento", () => {
    const gateway = (resposta: unknown) =>
      new ObrigacoesFiscaisHttpGateway(URL_BASE, jest.fn().mockResolvedValue(resposta));

    it("pede GET /clientes/{cnpj}/parcelamentos/{codigo} e lê a guia", async () => {
      const http = jest.fn().mockResolvedValue(
        json({
          nomeArquivo: "p.pdf",
          pdfBase64: "JVBERg==",
          parcela: "202609",
          valorCentavos: 45000,
        }),
      );

      const r = await new ObrigacoesFiscaisHttpGateway(URL_BASE, http).buscarGuiaParcelamento(
        "11444777000161",
        PEDIDO,
      );

      expect(http.mock.calls[0][0]).toBe(
        `${URL_BASE}/clientes/11444777000161/parcelamentos/PARC-AB12%2F34`,
      );
      expect(r.ok && r.value).toMatchObject({ parcela: "202609", valorCentavos: 45000 });
    });

    it.each(["codigo_desconhecido", "quitado", "fora_do_periodo", "ambiguo"] as const)(
      "422 com motivo %s vira erro tipado",
      async (motivo) => {
        const r = await gateway(json({ motivo }, 422)).buscarGuiaParcelamento("1", PEDIDO);

        expect(!r.ok && r.error).toBeInstanceOf(GuiaParcelamentoIndisponivelError);
        expect(
          !r.ok && r.error instanceof GuiaParcelamentoIndisponivelError && r.error.motivo,
        ).toBe(motivo);
      },
    );

    it("motivo fora do contrato ou 503 viram indisponibilidade, que repete", async () => {
      for (const resposta of [json({ motivo: "outro" }, 422), json({}, 503)]) {
        const r = await gateway(resposta).buscarGuiaParcelamento("1", PEDIDO);

        expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
      }
    });
  });
});

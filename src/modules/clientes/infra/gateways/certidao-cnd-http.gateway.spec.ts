import { CertidaoCndHttpGateway } from "./certidao-cnd-http.gateway";

const json = (corpo: unknown, status = 200) => ({
  ok: status < 300,
  status,
  json: async () => corpo,
});

describe("CertidaoCndHttpGateway", () => {
  it("lê a CND do contrato neutro", async () => {
    const http = jest
      .fn()
      .mockResolvedValue(
        json({ nomeArquivo: "cnd.pdf", pdfBase64: "JVBERg==", validade: "2027-03-31" }),
      );

    const r = await new CertidaoCndHttpGateway("http://f.test", http).buscarCnd("11444777000161");

    expect(http.mock.calls[0][0]).toBe("http://f.test/clientes/11444777000161/cnd");
    expect(r.ok && r.value.validade).toBe("2027-03-31");
  });

  it("status ruim, corpo fora do contrato e rede viram ServicoExternoError", async () => {
    for (const http of [
      jest.fn().mockResolvedValue(json({}, 503)),
      jest.fn().mockResolvedValue(json({ x: 1 })),
      jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    ]) {
      const r = await new CertidaoCndHttpGateway("http://f.test", http).buscarCnd("1");
      expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    }
  });
});

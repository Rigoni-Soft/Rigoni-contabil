import { CertidaoCndSerproGateway } from "./certidao-cnd-serpro.gateway";

const CRED = {
  urlToken: "https://auth.test/token",
  urlCertidao: "https://api.test/certidao",
  codigoIdentificacao: "9001",
  acesso: { tipo: "producao" as const, consumerKey: "k", consumerSecret: "s" },
};
const CNPJ = "11444777000161";
const token = { status: 200, corpo: JSON.stringify({ access_token: "a", expires_in: 3000 }) };
const resposta = (corpo: unknown, status = 200) => ({ status, corpo: JSON.stringify(corpo) });
const certidao = resposta({
  Status: 2,
  Certidao: { DataValidade: "2027-03-31", DocumentoPdf: "JVBERg==" },
});

function gateway(...respostas: { status: number; corpo: string }[]) {
  const http = jest.fn();
  respostas.forEach((r) => http.mockResolvedValueOnce(r));
  return { http, gw: new CertidaoCndSerproGateway(CRED, http, async () => {}) };
}

describe("CertidaoCndSerproGateway", () => {
  it("autentica sem certificado e devolve a CND no contrato neutro", async () => {
    const { http, gw } = gateway(token, certidao);

    const r = await gw.buscarCnd(CNPJ);

    expect(r).toEqual({
      ok: true,
      value: { nomeArquivo: `cnd-${CNPJ}.pdf`, pdfBase64: "JVBERg==", validade: "2027-03-31" },
    });
    expect(http.mock.calls[0][0].pfx).toBeUndefined();
    expect(JSON.parse(http.mock.calls[1][0].corpo)).toMatchObject({
      TipoContribuinte: 1,
      ContribuinteConsulta: CNPJ,
      CodigoIdentificacao: "9001",
      GerarCertidaoPdf: true,
    });
  });

  it("status 7 repete a consulta com a Chave até sair a certidão", async () => {
    const { http, gw } = gateway(token, resposta({ Status: 7, Chave: "abc" }, 201), certidao);

    const r = await gw.buscarCnd(CNPJ);

    expect(r.ok).toBe(true);
    expect(JSON.parse(http.mock.calls[2][0].corpo).Chave).toBe("abc");
  });

  it("certidão não emitida devolve a mensagem do Serpro como erro tratado", async () => {
    const { gw } = gateway(token, resposta({ Status: 4, Mensagem: "Pendência cadastral." }));

    const r = await gw.buscarCnd(CNPJ);

    expect(!r.ok && r.error).toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Pendência cadastral.",
    });
  });

  it("falha de autenticação ou formato inesperado vira ServicoExternoError", async () => {
    for (const { gw } of [
      gateway({ status: 401, corpo: "" }),
      gateway(token, resposta({ x: 1 })),
    ]) {
      const r = await gw.buscarCnd(CNPJ);
      expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    }
  });

  it("trial usa o token de demonstração direto, sem autenticar", async () => {
    const http = jest.fn().mockResolvedValue(certidao);
    const trial = new CertidaoCndSerproGateway(
      { ...CRED, acesso: { tipo: "trial", token: "demo" } },
      http,
      async () => {},
    );

    const r = await trial.buscarCnd(CNPJ);

    expect(r.ok).toBe(true);
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0].url).toBe(CRED.urlCertidao);
    expect(http.mock.calls[0][0].headers.Authorization).toBe("Bearer demo");
  });
});

import {
  ObrigacoesFiscaisSerproGateway,
  type RequisicaoHttp,
  type TransporteHttp,
} from "./obrigacoes-fiscais-serpro.gateway";

const CRED = {
  consumerKey: "k",
  consumerSecret: "s",
  certificadoP12: Buffer.from("p12"),
  certificadoSenha: "senha",
  cnpjEscritorio: "11222333000181",
};
const CLIENTE = "11444777000161";
const AGORA = () => new Date("2026-01-15T15:00:00Z"); // janeiro: mês anterior = dezembro

const token = {
  status: 200,
  corpo: JSON.stringify({ access_token: "a", jwt_token: "j", expires_in: 2000 }),
};
const envelope = (dados: unknown) => ({
  status: 200,
  corpo: JSON.stringify({ dados: JSON.stringify(dados) }),
});

function gateway(...respostas: { status: number; corpo: string }[]) {
  const http = jest.fn<ReturnType<TransporteHttp>, [RequisicaoHttp]>();
  respostas.forEach((r) => http.mockResolvedValueOnce(r));
  return { http, gw: new ObrigacoesFiscaisSerproGateway(CRED, http, AGORA) };
}

describe("ObrigacoesFiscaisSerproGateway", () => {
  it("autentica com e-CNPJ e pede o DAS do mês anterior, convertendo para o contrato neutro", async () => {
    const { http, gw } = gateway(
      token,
      envelope([
        {
          pdf: "JVBERg==",
          detalhamento: {
            periodoApuracao: "202512",
            numeroDocumento: "1",
            dataVencimento: "20260120",
            valores: { total: 1234.56 },
          },
        },
      ]),
    );

    const r = await gw.buscarDas(CLIENTE);

    expect(r).toEqual({
      ok: true,
      value: {
        nomeArquivo: `das-${CLIENTE}-202512.pdf`,
        pdfBase64: "JVBERg==",
        competencia: "2025-12",
        valorCentavos: 123456,
        vencimento: "2026-01-20",
      },
    });
    expect(http.mock.calls[0][0].pfx).toEqual(CRED.certificadoP12);
    const corpo = JSON.parse(http.mock.calls[1][0].corpo);
    expect(corpo.contribuinte.numero).toBe(CLIENTE);
    expect(corpo.pedidoDados).toMatchObject({ idSistema: "PGDASD", idServico: "GERARDAS12" });
    expect(JSON.parse(corpo.pedidoDados.dados)).toEqual({ periodoApuracao: "202512" });
  });

  it("guia de parcelamento traz só o PDF e a parcela do mês corrente", async () => {
    const { gw } = gateway(token, envelope({ docArrecadacaoPdfB64: "JVBERg==" }));

    const r = await gw.buscarGuiaParcelamento(CLIENTE);

    expect(r.ok && r.value).toMatchObject({ pdfBase64: "JVBERg==", parcela: "202601" });
  });

  it("tenta os parcelamentos em ordem até um emitir a parcela (4xx passa ao próximo)", async () => {
    const { http, gw } = gateway(
      token,
      { status: 400, corpo: "" },
      { status: 404, corpo: "" },
      envelope({ docArrecadacaoPdfB64: "JVBERg==" }),
    );

    const r = await gw.buscarGuiaParcelamento(CLIENTE);

    expect(r.ok && r.value.pdfBase64).toBe("JVBERg==");
    const sistemas = http.mock.calls
      .slice(1)
      .map((c) => JSON.parse(c[0].corpo).pedidoDados.idSistema);
    expect(sistemas).toEqual(["PARCSN", "PERTSN", "RELPSN"]);
  });

  it("sem parcelamento em nenhum sistema é erro tratado; 5xx interrompe a busca", async () => {
    const { http, gw } = gateway(
      token,
      ...Array.from({ length: 6 }, () => ({ status: 400, corpo: "" })),
    );
    expect((await gw.buscarGuiaParcelamento(CLIENTE)).ok).toBe(false);
    expect(http).toHaveBeenCalledTimes(7);

    const { http: http2, gw: gw2 } = gateway(token, { status: 503, corpo: "" });
    expect((await gw2.buscarGuiaParcelamento(CLIENTE)).ok).toBe(false);
    expect(http2).toHaveBeenCalledTimes(2);
  });

  it("reautentica uma vez quando o token expirou (401)", async () => {
    const { http, gw } = gateway(
      token,
      { status: 401, corpo: "" },
      token,
      envelope({ docArrecadacaoPdfB64: "x" }),
    );

    const r = await gw.buscarGuiaParcelamento(CLIENTE);

    expect(r.ok).toBe(true);
    expect(http).toHaveBeenCalledTimes(4);
  });

  it("procuração vigente devolve a maior data; vencida ou ausente, vigente:false", async () => {
    const { gw: com } = gateway(
      token,
      envelope([{ dtexpiracao: "20260101" }, { dtexpiracao: "20271231" }]),
    );
    expect(await com.consultarAutorizacao(CLIENTE)).toEqual({
      ok: true,
      value: { vigente: true, dataExpiracao: "2027-12-31" },
    });

    const { gw: vencida } = gateway(token, envelope([{ dtexpiracao: "20251231" }]));
    expect(await vencida.consultarAutorizacao(CLIENTE)).toEqual({
      ok: true,
      value: { vigente: false },
    });

    const { gw: ausente } = gateway(token, { status: 404, corpo: "" });
    expect(await ausente.consultarAutorizacao(CLIENTE)).toEqual({
      ok: true,
      value: { vigente: false },
    });
  });

  it("falhas viram ServicoExternoError sem lançar", async () => {
    const { gw: autenticacao } = gateway({ status: 403, corpo: "" });
    const { gw: rede } = new Array(1).fill(0).map(() => ({
      gw: new ObrigacoesFiscaisSerproGateway(
        CRED,
        jest.fn().mockRejectedValue(new Error("x")),
        AGORA,
      ),
    }))[0];
    const { gw: formato } = gateway(token, envelope({ inesperado: true }));

    for (const gw of [autenticacao, rede, formato]) {
      const r = await gw.buscarDas(CLIENTE);
      expect(!r.ok && r.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    }
  });
});

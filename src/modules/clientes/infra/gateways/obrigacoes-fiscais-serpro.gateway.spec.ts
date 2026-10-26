import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";

import {
  ObrigacoesFiscaisSerproGateway,
  type RequisicaoHttp,
  type TransporteHttp,
} from "./obrigacoes-fiscais-serpro.gateway";

const CRED = {
  urlAutenticacao: "https://auth.test/authenticate",
  urlBase: "https://api.test/v1",
  cnpjEscritorio: "11222333000181",
  acesso: {
    tipo: "producao" as const,
    consumerKey: "k",
    consumerSecret: "s",
    certificadoP12: Buffer.from("p12"),
    certificadoSenha: "senha",
  },
};
const CLIENTE = "11444777000161";
const AGORA = () => new Date("2026-01-15T15:00:00Z"); // janeiro: mês anterior = dezembro

const PEDIDO = { regime: "simples_nacional" as const, ignorar: [] as string[] };

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
    expect(http.mock.calls[0][0].url).toBe(CRED.urlAutenticacao);
    expect(http.mock.calls[0][0].pfx).toEqual(CRED.acesso.certificadoP12);
    expect(http.mock.calls[1][0].url).toBe("https://api.test/v1/Emitir");
    const corpo = JSON.parse(http.mock.calls[1][0].corpo);
    expect(corpo.contribuinte.numero).toBe(CLIENTE);
    expect(corpo.pedidoDados).toMatchObject({ idSistema: "PGDASD", idServico: "GERARDAS12" });
    expect(JSON.parse(corpo.pedidoDados.dados)).toEqual({ periodoApuracao: "202512" });
  });

  describe("guias de parcelamento", () => {
    const lista = (...parcelas: [number, number][]) =>
      envelope({ listaParcela: parcelas.map(([parcela, valor]) => ({ parcela, valor })) });
    const pdf = envelope({ docArrecadacaoPdfB64: "JVBERg==" });
    // Respostas gravadas do Integra-Parcelamento (docs/pesquisa/serpro-guia-parcelamento.md): a
    // mensagem de negócio vem em `mensagens[].codigo`.
    const recusa = (er: string, status = 400) => ({
      status,
      corpo: JSON.stringify({ mensagens: [{ codigo: `[Aviso-PARCSN-${er}]`, texto: "..." }] }),
    });
    const servico = (http: jest.Mock, n: number) =>
      JSON.parse(http.mock.calls[n][0].corpo).pedidoDados.idServico;

    it("lista as parcelas emitíveis e emite uma guia por parcela, sem consultar a autorização", async () => {
      const { http, gw } = gateway(token, lista([202512, 100.5], [202601, 200]), pdf, pdf);

      const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

      expect(r).toEqual({
        ok: true,
        value: [
          {
            nomeArquivo: `parcelamento-${CLIENTE}-202512.pdf`,
            pdfBase64: "JVBERg==",
            parcela: "202512",
            valorCentavos: 10050,
          },
          {
            nomeArquivo: `parcelamento-${CLIENTE}-202601.pdf`,
            pdfBase64: "JVBERg==",
            parcela: "202601",
            valorCentavos: 20000,
          },
        ],
      });
      expect(http).toHaveBeenCalledTimes(4); // token + lista + 2 guias
      expect([1, 2, 3].map((n) => servico(http, n))).toEqual([
        "PARCELASPARAGERAR162",
        "GERARDAS161",
        "GERARDAS161",
      ]);
      expect(http.mock.calls[2][0].url).toBe("https://api.test/v1/Emitir");
      expect(JSON.parse(JSON.parse(http.mock.calls[3][0].corpo).pedidoDados.dados)).toEqual({
        parcelaParaEmitir: 202601,
      });
    });

    it("o regime escolhe o PARC: SN em PARCSN, MEI em PARCMEI", async () => {
      for (const [regime, sistema, consulta, emissao] of [
        ["simples_nacional", "PARCSN", "PARCELASPARAGERAR162", "GERARDAS161"],
        ["mei", "PARCMEI", "PARCELASPARAGERAR202", "GERARDAS201"],
      ] as const) {
        const { http, gw } = gateway(token, lista([202601, 1]), pdf);

        const r = await gw.buscarGuiasParcelamento(CLIENTE, { ...PEDIDO, regime });

        expect(r.ok && r.value).toHaveLength(1);
        for (const n of [1, 2]) {
          expect(JSON.parse(http.mock.calls[n][0].corpo).pedidoDados).toMatchObject({
            idSistema: sistema,
            idServico: n === 1 ? consulta : emissao,
          });
        }
      }
    });

    it("não emite (nem paga) as parcelas já entregues", async () => {
      const { http, gw } = gateway(token, lista([202512, 1], [202601, 2]), pdf);

      const r = await gw.buscarGuiasParcelamento(CLIENTE, { ...PEDIDO, ignorar: ["202512"] });

      expect(r.ok && r.value.map((g) => g.parcela)).toEqual(["202601"]);
      expect(http).toHaveBeenCalledTimes(3);
    });

    it.each([
      ["lista vazia", lista()],
      ["sem parcelamento ativo (ER_E001)", recusa("ER_E001")],
      ["sem saldo devedor (ER_N003)", recusa("ER_N003")],
      ["sem dados (404)", { status: 404, corpo: "" }],
    ])("%s: nenhuma guia, e nenhuma emissão", async (_caso, resposta) => {
      const { http, gw } = gateway(token, resposta);

      const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

      expect(r).toEqual({ ok: true, value: [] });
      expect(http).toHaveBeenCalledTimes(2);
    });

    it("parcela que o Serpro ainda não emite (ER_N005/ER_N006) fica de fora, as outras seguem", async () => {
      const { gw } = gateway(
        token,
        lista([202512, 1], [202601, 2], [202602, 3]),
        recusa("ER_N006"),
        pdf,
        recusa("ER_N005"),
      );

      const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

      expect(r.ok && r.value.map((g) => g.parcela)).toEqual(["202601"]);
    });

    it("queda no meio devolve as guias já baixadas; as outras vêm na próxima rodada", async () => {
      const { gw } = gateway(token, lista([202512, 1], [202601, 2]), pdf, {
        status: 500,
        corpo: "",
      });

      const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

      expect(r.ok && r.value.map((g) => g.parcela)).toEqual(["202512"]);
    });

    it("falha sem nenhuma guia consulta a autorização uma vez: vencida vira ForbiddenError", async () => {
      const { http, gw } = gateway(token, { status: 403, corpo: "" }, envelope([]));

      const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

      expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
      expect(http).toHaveBeenCalledTimes(3);
      expect(servico(http, 2)).toBe("OBTERPROCURACAO41");
    });

    it("falha sem nenhuma guia com autorização vigente, ou sem resposta dela, é indisponibilidade", async () => {
      for (const autorizacao of [
        envelope([{ dtexpiracao: "20991231" }]),
        { status: 500, corpo: "" },
      ]) {
        const { gw } = gateway(token, { status: 500, corpo: "" }, autorizacao);

        const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

        expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
      }
    });
  });

  it("reautentica uma vez quando o token expirou (401)", async () => {
    const { http, gw } = gateway(
      token,
      { status: 401, corpo: "" },
      token,
      envelope({ listaParcela: [{ parcela: 202601, valor: 1 }] }),
      envelope({ docArrecadacaoPdfB64: "x" }),
    );

    const r = await gw.buscarGuiasParcelamento(CLIENTE, PEDIDO);

    expect(r.ok && r.value).toHaveLength(1);
    expect(http).toHaveBeenCalledTimes(5);
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

  it("trial usa o token de demonstração direto: sem autenticar, sem certificado, sem jwt_token", async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce(envelope({ listaParcela: [{ parcela: 202601, valor: 1 }] }))
      .mockResolvedValueOnce(envelope({ docArrecadacaoPdfB64: "JVBERg==" }));
    const trial = new ObrigacoesFiscaisSerproGateway(
      { ...CRED, acesso: { tipo: "trial", token: "demo" } },
      http,
      AGORA,
    );

    const r = await trial.buscarGuiasParcelamento(CLIENTE, PEDIDO);

    expect(r.ok && r.value).toHaveLength(1);
    expect(http).toHaveBeenCalledTimes(2);
    expect(http.mock.calls[0][0].headers).toEqual({
      Authorization: "Bearer demo",
      "Content-Type": "application/json",
    });
    expect(http.mock.calls[0][0].pfx).toBeUndefined();
  });
});

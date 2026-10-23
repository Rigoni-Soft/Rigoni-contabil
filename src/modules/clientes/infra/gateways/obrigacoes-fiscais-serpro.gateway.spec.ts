import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { GuiaParcelamentoIndisponivelError } from "@/shared/errors/guia-parcelamento-indisponivel.error";
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

const PEDIDO = {
  codigo: "PARC-AB12CD34",
  regime: "simples_nacional" as const,
  emAbertoDaReceita: 1,
};

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

  it("guia de parcelamento pede direto a parcela do mês corrente, sem consultar a autorização", async () => {
    const { http, gw } = gateway(token, envelope({ docArrecadacaoPdfB64: "JVBERg==" }));

    const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

    expect(r).toEqual({
      ok: true,
      value: {
        nomeArquivo: `parcelamento-${CLIENTE}-202601.pdf`,
        pdfBase64: "JVBERg==",
        parcela: "202601",
      },
    });
    expect(http).toHaveBeenCalledTimes(2); // token + a guia: nenhuma consulta de autorização
    expect(http.mock.calls[1][0].url).toBe("https://api.test/v1/Emitir");
  });

  it("o código é rótulo nosso: não vai ao Serpro, que emite só pela parcela", async () => {
    const { http, gw } = gateway(token, envelope({ docArrecadacaoPdfB64: "x" }));

    await gw.buscarGuiaParcelamento(CLIENTE, { ...PEDIDO, codigo: "PARC-AB12CD34" });

    const corpo = http.mock.calls[1][0].corpo;
    expect(corpo).not.toContain("PARC-AB12CD34");
    expect(JSON.parse(JSON.parse(corpo).pedidoDados.dados)).toEqual({ parcelaParaEmitir: 202601 });
  });

  it("parcelamento usa o PARC do regime do Cliente: SN em PARCSN, MEI em PARCMEI", async () => {
    for (const [regime, sistema, servico] of [
      ["simples_nacional", "PARCSN", "GERARDAS161"],
      ["mei", "PARCMEI", "GERARDAS201"],
    ] as const) {
      const { http, gw } = gateway(token, envelope({ docArrecadacaoPdfB64: "JVBERg==" }));

      const r = await gw.buscarGuiaParcelamento(CLIENTE, { ...PEDIDO, regime });

      expect(r.ok).toBe(true);
      expect(JSON.parse(http.mock.calls[1][0].corpo).pedidoDados).toMatchObject({
        idSistema: sistema,
        idServico: servico,
      });
    }
  });

  describe("guia de parcelamento que o Serpro não emite", () => {
    // Respostas gravadas do Integra-Parcelamento (docs/pesquisa/serpro-guia-parcelamento.md): a
    // mensagem de negócio vem em `mensagens[].codigo`.
    const recusa = (er: string, status = 400) => ({
      status,
      corpo: JSON.stringify({ mensagens: [{ codigo: `[Aviso-PARCSN-${er}]`, texto: "..." }] }),
    });
    const motivoDe = (
      r: Awaited<ReturnType<ObrigacoesFiscaisSerproGateway["buscarGuiaParcelamento"]>>,
    ) => (!r.ok && r.error instanceof GuiaParcelamentoIndisponivelError ? r.error.motivo : null);

    it.each([
      ["ER_E001", "codigo_desconhecido"], // sem parcelamento ativo
      ["ER_N003", "quitado"], // sem saldo devedor
      ["ER_N006", "fora_do_periodo"], // parcela inexistente, paga ou de mês futuro
      ["ER_N005", "fora_do_periodo"], // parcela do mês só emitível a partir de certo dia
      ["ER_N008", "fora_do_periodo"], // sem parcelas para emissão
    ])("%s vira %s, sem consultar a autorização", async (er, motivo) => {
      const { http, gw } = gateway(token, recusa(er));

      const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

      expect(motivoDe(r)).toBe(motivo);
      expect(http).toHaveBeenCalledTimes(2);
    });

    it("sem dados (404) é código desconhecido: o Serpro não tem parcelamento ativo", async () => {
      const { gw } = gateway(token, { status: 404, corpo: "" });

      expect(motivoDe(await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO))).toBe(
        "codigo_desconhecido",
      );
    });

    it("com mais de um parcelamento da Receita em aberto não atribui a guia: ambiguo, sem chamar o Serpro", async () => {
      const { http, gw } = gateway();

      const r = await gw.buscarGuiaParcelamento(CLIENTE, { ...PEDIDO, emAbertoDaReceita: 2 });

      expect(motivoDe(r)).toBe("ambiguo");
      expect(http).not.toHaveBeenCalled();
    });

    it("falha sem motivo conhecido consulta a autorização uma vez: vencida vira ForbiddenError", async () => {
      const { http, gw } = gateway(token, { status: 403, corpo: "" }, envelope([]));

      const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

      expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
      expect(http).toHaveBeenCalledTimes(3);
      expect(JSON.parse(http.mock.calls[2][0].corpo).pedidoDados.idSistema).toBe("PROCURACOES");
    });

    it("falha sem motivo conhecido com autorização vigente segue como indisponibilidade", async () => {
      const { gw } = gateway(
        token,
        { status: 500, corpo: "" },
        envelope([{ dtexpiracao: "20991231" }]),
      );

      const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

      expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
    });

    it("se nem a autorização responde, a falha é a da guia (indisponibilidade)", async () => {
      const { gw } = gateway(token, { status: 500, corpo: "" }, { status: 500, corpo: "" });

      const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

      expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
    });
  });

  it("reautentica uma vez quando o token expirou (401)", async () => {
    const { http, gw } = gateway(
      token,
      { status: 401, corpo: "" },
      token,
      envelope({ docArrecadacaoPdfB64: "x" }),
    );

    const r = await gw.buscarGuiaParcelamento(CLIENTE, PEDIDO);

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

  it("trial usa o token de demonstração direto: sem autenticar, sem certificado, sem jwt_token", async () => {
    const http = jest.fn().mockResolvedValue(envelope({ docArrecadacaoPdfB64: "JVBERg==" }));
    const trial = new ObrigacoesFiscaisSerproGateway(
      { ...CRED, acesso: { tipo: "trial", token: "demo" } },
      http,
      AGORA,
    );

    const r = await trial.buscarGuiaParcelamento(CLIENTE, PEDIDO);

    expect(r.ok).toBe(true);
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0].headers).toEqual({
      Authorization: "Bearer demo",
      "Content-Type": "application/json",
    });
    expect(http.mock.calls[0][0].pfx).toBeUndefined();
  });
});

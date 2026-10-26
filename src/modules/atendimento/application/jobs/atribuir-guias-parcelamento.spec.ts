import { atribuirGuiasParcelamento } from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";

const guia = (parcela: string, valorCentavos?: number): GuiaFiscal => ({
  nomeArquivo: `${parcela}.pdf`,
  pdfBase64: "JVBERi0=",
  parcela,
  valorCentavos,
});

const parcelamento = (
  id: string,
  valorParcelaCentavos: number | null,
  enviadas: string[] = [],
) => ({
  id,
  codigo: `COD-${id}`,
  interno: false,
  valorParcelaCentavos,
  parcelasRestantes: 5,
  parcelasEnviadas: enviadas,
});

const ids = (atribuidas: ReturnType<typeof atribuirGuiasParcelamento>) =>
  atribuidas.map((a) => a.parcelamento.id);

describe("atribuirGuiasParcelamento", () => {
  it("com um parcelamento em aberto, todas as guias vão a ele, mesmo com valor diferente", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202609", 15_000), guia("202610", 10_000)],
      [parcelamento("p1", 10_000)],
    );
    expect(atribuidas.map((a) => [a.parcelamento.id, a.guia.parcela])).toEqual([
      ["p1", "202609"],
      ["p1", "202610"],
    ]);
  });

  it("com vários, a guia vai ao único cujo valor guardado não passa do valor dela", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 25_000)],
      [parcelamento("medio", 24_000), parcelamento("caro", 40_000)],
    );
    expect(ids(atribuidas)).toEqual(["medio"]);
  });

  it("dois candidatos compatíveis de valores diferentes bloqueiam, com A aberto e já entregue", () => {
    expect(
      atribuirGuiasParcelamento(
        [guia("202610", 30_500)],
        [parcelamento("a", 30_000, ["202610"]), parcelamento("b", 30_200)],
        [{ parcelamentoId: "a", parcela: "202610", identidade: "202610:30000" }],
      ),
    ).toEqual([]);
  });

  it.each([
    [[30_000, 30_200], 30_500],
    [[10_000, 24_000, 25_000], 26_000],
    [[1, 2], 999_999],
  ])("com valores %j e guia de %i, nenhum acordo recebe", (valores, valorGuia) => {
    const parcelamentos = valores.map((v, i) => parcelamento(`p${i}`, v));
    expect(atribuirGuiasParcelamento([guia("202610", valorGuia)], parcelamentos)).toEqual([]);
  });

  it("dois parcelamentos de mesmo valor, mesmo sem envio, não recebem guia (nada prova de qual é)", () => {
    expect(
      atribuirGuiasParcelamento(
        [guia("202610", 10_000), guia("202610", 10_000)],
        [parcelamento("a", 10_000), parcelamento("b", 10_000)],
      ),
    ).toEqual([]);
    expect(
      atribuirGuiasParcelamento(
        [guia("202610", 10_000)],
        [parcelamento("a", 10_000, ["202610"]), parcelamento("b", 10_000)],
      ),
    ).toEqual([]);
  });

  it("reemissão com valor corrigido de acordo quitado não vai ao único acordo em aberto", () => {
    const entregues = [
      { parcelamentoId: "quitado", parcela: "202610", identidade: "202610:30000" },
    ];
    expect(
      atribuirGuiasParcelamento([guia("202610", 30_500)], [parcelamento("b", 10_000)], entregues),
    ).toEqual([]);
  });

  it("envio de acordo quitado sem identidade (legado) bloqueia a guia da mesma parcela", () => {
    const entregues = [{ parcelamentoId: "quitado", parcela: "202610", identidade: null }];
    expect(
      atribuirGuiasParcelamento([guia("202610", 10_000)], [parcelamento("b", 10_000)], entregues),
    ).toEqual([]);
    expect(
      atribuirGuiasParcelamento([guia("202611", 10_000)], [parcelamento("b", 10_000)], entregues),
    ).toHaveLength(1);
  });

  it("guia de identidade já entregue (mesmo a acordo quitado, fora da lista) é descartada", () => {
    const entregues = [
      { parcelamentoId: "quitado", parcela: "202610", identidade: "202610:10000" },
    ];
    expect(
      atribuirGuiasParcelamento([guia("202610", 10_000)], [parcelamento("b", 10_000)], entregues),
    ).toEqual([]);
  });

  it("cada entrega anterior consome só uma guia de mesma identidade; a que sobra é atribuída", () => {
    const entregues = [{ parcelamentoId: "a", parcela: "202610", identidade: "202610:10000" }];
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 10_000), guia("202610", 10_000)],
      [parcelamento("b", 10_000)],
      entregues,
    );
    expect(ids(atribuidas)).toEqual(["b"]);
  });

  it("nova emissão da guia de quem já a recebeu é descartada, não vai a outro parcelamento", () => {
    // a (30 mil) já recebeu 202610; o provedor a emite de novo e b (10 mil) ainda espera a dele.
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 30_000), guia("202610", 10_000)],
      [parcelamento("a", 30_000, ["202610"]), parcelamento("b", 10_000)],
    );
    expect(atribuidas.map((a) => [a.parcelamento.id, a.guia.valorCentavos])).toEqual([
      ["b", 10_000],
    ]);
  });

  it("com um só parcelamento que já recebeu a parcela, a nova emissão é descartada", () => {
    expect(
      atribuirGuiasParcelamento([guia("202610", 10_000)], [parcelamento("a", 10_000, ["202610"])]),
    ).toEqual([]);
  });

  it("guia menor que todos os valores guardados, ou sem valor, não é atribuída (falha fechado)", () => {
    expect(
      atribuirGuiasParcelamento(
        [guia("202610", 5_000), guia("202611")],
        [parcelamento("a", 10_000), parcelamento("b", 20_000)],
      ),
    ).toEqual([]);
  });

  it("acordo de valor desconhecido continua possível dono: com outro acordo, a guia não é atribuída", () => {
    const sintetica = guia("202610", 30_500);
    const nulo = parcelamento("a", null);
    const conhecido = parcelamento("b", 10_000);
    expect(atribuirGuiasParcelamento([sintetica], [nulo, conhecido])).toEqual([]);
    expect(atribuirGuiasParcelamento([sintetica], [conhecido, nulo])).toEqual([]);
    expect(
      atribuirGuiasParcelamento(
        [sintetica],
        [
          { ...nulo, interno: true },
          { ...conhecido, interno: false },
        ],
      ),
    ).toEqual([]);
  });

  it("valor desconhecido só atribui quando é o único compatível comprovável", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 30_500)],
      [parcelamento("a", null), parcelamento("b", 50_000)],
    );
    expect(ids(atribuidas)).toEqual(["a"]);
  });
});

import { atribuirGuiasParcelamento } from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";

const guia = (parcela: string, valorCentavos?: number): GuiaFiscal => ({
  nomeArquivo: `${parcela}.pdf`,
  pdfBase64: "JVBERi0=",
  parcela,
  valorCentavos,
});

const parcelamento = (id: string, valorParcelaCentavos: number | null, enviadas: string[] = []) => ({
  id,
  valorParcelaCentavos,
  parcelasEnviadas: enviadas,
});

describe("atribuirGuiasParcelamento", () => {
  it("com um parcelamento em aberto, todas as guias vão a ele, mesmo com valor diferente", () => {
    const { atribuidas, semAtribuicao } = atribuirGuiasParcelamento(
      [guia("202609", 15_000), guia("202610", 10_000)],
      [parcelamento("p1", 10_000)],
    );
    expect(atribuidas.map((a) => [a.parcelamentoId, a.guia.parcela])).toEqual([
      ["p1", "202609"],
      ["p1", "202610"],
    ]);
    expect(semAtribuicao).toEqual([]);
  });

  it("com vários, a guia vai ao de valor guardado mais próximo sem passar do valor da guia", () => {
    const { atribuidas } = atribuirGuiasParcelamento(
      [guia("202610", 25_000)],
      [parcelamento("barato", 10_000), parcelamento("medio", 24_000), parcelamento("caro", 40_000)],
    );
    expect(atribuidas.map((a) => a.parcelamentoId)).toEqual(["medio"]);
  });

  it("um parcelamento nunca recebe duas guias da mesma parcela; a segunda vai ao outro", () => {
    const { atribuidas } = atribuirGuiasParcelamento(
      [guia("202610", 10_000), guia("202610", 10_000)],
      [parcelamento("a", 10_000), parcelamento("b", 10_000)],
    );
    expect(atribuidas.map((a) => a.parcelamentoId).sort()).toEqual(["a", "b"]);
  });

  it("parcela já enviada ao parcelamento não é atribuída de novo a ele", () => {
    const { atribuidas, semAtribuicao } = atribuirGuiasParcelamento(
      [guia("202610", 10_000)],
      [parcelamento("a", 10_000, ["202610"]), parcelamento("b", 10_000)],
    );
    expect(atribuidas.map((a) => a.parcelamentoId)).toEqual(["b"]);
    expect(semAtribuicao).toEqual([]);
  });

  it("guia menor que todos os valores guardados, ou sem valor, fica sem atribuição (falha fechado)", () => {
    const { atribuidas, semAtribuicao } = atribuirGuiasParcelamento(
      [guia("202610", 5_000), guia("202611")],
      [parcelamento("a", 10_000), parcelamento("b", 20_000)],
    );
    expect(atribuidas).toEqual([]);
    expect(semAtribuicao.map((g) => g.parcela)).toEqual(["202610", "202611"]);
  });
});

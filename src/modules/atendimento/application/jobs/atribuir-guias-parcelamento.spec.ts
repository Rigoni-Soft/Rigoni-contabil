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

  it("com vários, a guia vai ao de valor guardado mais próximo sem passar do valor da guia", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 25_000)],
      [parcelamento("barato", 10_000), parcelamento("medio", 24_000), parcelamento("caro", 40_000)],
    );
    expect(ids(atribuidas)).toEqual(["medio"]);
  });

  it("um parcelamento nunca recebe duas guias da mesma parcela; a segunda vai ao outro de mesmo valor", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 10_000), guia("202610", 10_000)],
      [parcelamento("a", 10_000), parcelamento("b", 10_000)],
    );
    expect(ids(atribuidas).sort()).toEqual(["a", "b"]);
  });

  it("parcela já enviada a um de dois de mesmo valor vai ao outro", () => {
    const atribuidas = atribuirGuiasParcelamento(
      [guia("202610", 10_000)],
      [parcelamento("a", 10_000, ["202610"]), parcelamento("b", 10_000)],
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
});

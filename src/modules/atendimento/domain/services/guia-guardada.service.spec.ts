import { chaveDoDas, chaveDoParcelamento } from "./guia-guardada.service";

describe("guia guardada", () => {
  it("o DAS é guardado pelo mês do envio, venha ele como mês ou como data", () => {
    expect(chaveDoDas("2026-10")).toEqual({ id: "das", periodo: "202610" });
    expect(chaveDoDas("2026-10-05")).toEqual({ id: "das", periodo: "202610" });
  });

  it("o parcelamento é guardado pelo id do acordo e pela parcela", () => {
    expect(chaveDoParcelamento("acordo-1", "202610")).toEqual({
      id: "acordo-1",
      periodo: "202610",
    });
  });
});

import { juntarResumoRh } from "./juntar-resumo-rh";

describe("juntarResumoRh", () => {
  const resumo = {
    totalClientes: 4,
    cards: [{ id: "com_parcelamento" }],
    grupos: [{ titulo: "Parcelamento", cardIds: ["com_parcelamento"] }],
  };
  const doMes = {
    cards: [{ id: "servico_fgts" }],
    grupo: { titulo: "Acompanhamento", cardIds: ["servico_fgts"] },
  };

  it("põe o acompanhamento antes do Parcelamento", () => {
    const r = juntarResumoRh(resumo, doMes);

    expect(r.grupos.map((g) => g.titulo)).toEqual(["Acompanhamento", "Parcelamento"]);
    expect(r.cards.map((c) => c.id)).toEqual(["com_parcelamento", "servico_fgts"]);
    expect(r.totalClientes).toBe(4);
  });

  it("sem o acompanhamento (a leitura falhou), só o Parcelamento", () => {
    const r = juntarResumoRh(resumo, undefined);

    expect(r.grupos.map((g) => g.titulo)).toEqual(["Parcelamento"]);
  });
});

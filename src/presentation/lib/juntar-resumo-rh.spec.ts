import { juntarResumoRh } from "./juntar-resumo-rh";

describe("juntarResumoRh", () => {
  const resumo = {
    totalClientes: 4,
    cards: [{ id: "atribuidos" }, { id: "com_parcelamento" }],
    grupos: [
      { titulo: "Carteira", cardIds: ["atribuidos"] },
      { titulo: "Parcelamento", cardIds: ["com_parcelamento"] },
    ],
  };
  const doMes = {
    cards: [{ id: "servico_fgts" }],
    grupo: { titulo: "Acompanhamento", cardIds: ["servico_fgts"] },
  };
  const funcionarios = {
    cards: [{ id: "funcionario_u1" }],
    grupo: { titulo: "Funcionários", cardIds: ["funcionario_u1"] },
  };

  it("põe o acompanhamento e os funcionários entre a carteira e o Parcelamento", () => {
    const r = juntarResumoRh(resumo, doMes, funcionarios);

    expect(r.grupos.map((g) => g.titulo)).toEqual([
      "Carteira",
      "Acompanhamento",
      "Funcionários",
      "Parcelamento",
    ]);
    expect(r.cards.map((c) => c.id)).toEqual([
      "atribuidos",
      "com_parcelamento",
      "servico_fgts",
      "funcionario_u1",
    ]);
    expect(r.totalClientes).toBe(4);
  });

  it("sem funcionários (quem não é Líder nem Admin), só o acompanhamento entra", () => {
    const r = juntarResumoRh(resumo, doMes);

    expect(r.grupos.map((g) => g.titulo)).toEqual(["Carteira", "Acompanhamento", "Parcelamento"]);
  });

  it("um grupo que falhou na leitura (undefined) é pulado", () => {
    const r = juntarResumoRh(resumo, undefined, funcionarios);

    expect(r.grupos.map((g) => g.titulo)).toEqual(["Carteira", "Funcionários", "Parcelamento"]);
  });
});

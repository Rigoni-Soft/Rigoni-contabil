import { semChaves } from "./salvar-parcelamentos-do-setor.presenter";

// O módulo importa as Server Actions, que carregam o env do servidor: aqui só se testa a função pura.
jest.mock("../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions", () => ({}));
jest.mock("./salvar-parcelamentos.actions", () => ({}));

describe("semChaves", () => {
  it("remove só as chaves dadas", () => {
    expect(semChaves({ a: 1, b: 2, c: 3 }, "a", "c")).toEqual({ b: 2 });
  });
});

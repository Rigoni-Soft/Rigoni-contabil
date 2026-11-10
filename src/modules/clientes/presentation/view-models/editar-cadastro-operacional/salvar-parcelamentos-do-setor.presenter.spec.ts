import { semChaves } from "./salvar-parcelamentos-do-setor.presenter";

describe("semChaves", () => {
  it("remove só as chaves dadas", () => {
    expect(semChaves({ a: 1, b: 2, c: 3 }, "a", "c")).toEqual({ b: 2 });
  });
});

import { opcaoUnica, opcoesDe } from "./opcoes";

describe("opcoesDe", () => {
  it("monta {valor, rotulo} na ordem dos valores", () => {
    expect(opcoesDe(["a", "b"] as const, { a: "A", b: "B" })).toEqual([
      { valor: "a", rotulo: "A" },
      { valor: "b", rotulo: "B" },
    ]);
  });
});

describe("opcaoUnica", () => {
  it("só devolve quando há exatamente uma", () => {
    expect(opcaoUnica(["x"])).toBe("x");
    expect(opcaoUnica(["x", "y"])).toBeUndefined();
  });
});

import { ehSetor, SETORES } from "./setores";

describe("ehSetor", () => {
  it("aceita cada Setor da lista e recusa o que não é Setor", () => {
    expect(SETORES.every(ehSetor)).toBe(true);
    expect(ehSetor("ninguem")).toBe(false);
    expect(ehSetor("")).toBe(false);
  });
});

import { SetorDoAtor } from "./setor-do-ator.vo";

describe("SetorDoAtor", () => {
  it("aceita um setor conhecido", () => {
    const r = SetorDoAtor.criar("administrativo");
    expect(r.ok && r.value.slug).toBe("administrativo");
  });

  it.each(["", "ti", "Administrativo"])("rejeita %p", (entrada) => {
    expect(SetorDoAtor.criar(entrada).ok).toBe(false);
  });
});

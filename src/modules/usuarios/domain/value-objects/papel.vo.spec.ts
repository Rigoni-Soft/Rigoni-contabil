import { Papel } from "./papel.vo";

describe("Papel", () => {
  it("cria um papel válido", () => {
    const resultado = Papel.criar("admin");

    expect(resultado.ok).toBe(true);
  });

  it("rejeita um papel desconhecido", () => {
    const resultado = Papel.criar("gerente");

    expect(resultado.ok).toBe(false);
  });

  it("ehAdmin é verdadeiro só para admin", () => {
    const admin = Papel.criar("admin");
    const funcionario = Papel.criar("funcionario");

    expect(admin.ok && admin.value.ehAdmin()).toBe(true);
    expect(funcionario.ok && funcionario.value.ehAdmin()).toBe(false);
  });

  it("ehLiderSetor é verdadeiro só para lider_setor", () => {
    const lider = Papel.criar("lider_setor");

    expect(lider.ok && lider.value.ehLiderSetor()).toBe(true);
  });
});

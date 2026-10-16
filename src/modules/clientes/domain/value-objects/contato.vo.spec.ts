import { Contato } from "./contato.vo";

describe("Contato", () => {
  it("cria um contato válido", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: "11999990000", padrao: true });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.nome).toBe("Maria");
      expect(resultado.value.telefone).toBe("11999990000");
      expect(resultado.value.padrao).toBe(true);
    }
  });

  it("rejeita nome vazio", () => {
    const resultado = Contato.criar({ nome: "", telefone: "11999990000", padrao: false });

    expect(resultado.ok).toBe(false);
  });

  it("rejeita telefone vazio", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: "", padrao: false });

    expect(resultado.ok).toBe(false);
  });
});

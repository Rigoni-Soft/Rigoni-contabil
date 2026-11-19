import { Contato } from "./contato.vo";

describe("Contato", () => {
  it("cria um contato válido só com WhatsApp", () => {
    const resultado = Contato.criar({ nome: " Maria ", telefone: "11999990000", email: "" });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.nome).toBe("Maria");
      expect(resultado.value.telefone).toBe("11999990000");
      expect(resultado.value.email).toBe("");
    }
  });

  it("cria um contato válido só com e-mail, em minúsculas", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: "", email: "Maria@Exemplo.com" });

    expect(resultado.ok && resultado.value.email).toBe("maria@exemplo.com");
  });

  it("rejeita nome vazio", () => {
    const resultado = Contato.criar({ nome: " ", telefone: "11999990000", email: "" });

    expect(resultado.ok).toBe(false);
  });

  it("rejeita contato sem WhatsApp nem e-mail", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: " ", email: "" });

    expect(resultado.ok).toBe(false);
  });

  it("rejeita WhatsApp sem DDD", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: "99999-0000", email: "" });

    expect(resultado.ok).toBe(false);
  });

  it("aceita o WhatsApp legado sem DDD inalterado e rejeita o alterado", () => {
    const legado = { nome: "Maria", email: "", telefoneOriginal: "99999-0000" };

    expect(Contato.criar({ ...legado, telefone: "999990000" }).ok).toBe(true);
    expect(Contato.criar({ ...legado, telefone: "88888-0000" }).ok).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const resultado = Contato.criar({ nome: "Maria", telefone: "", email: "maria" });

    expect(resultado.ok).toBe(false);
  });

  it("guarda o Setor dono e os Setores vindos do banco", () => {
    const resultado = Contato.criar({
      nome: "Maria",
      telefone: "11999990000",
      email: "",
      donoSetor: "rh",
      setores: ["ura", "rh"],
    });

    expect(resultado.ok && resultado.value.donoSetor).toBe("rh");
    expect(resultado.ok && resultado.value.setores).toEqual(["ura", "rh"]);
  });
});

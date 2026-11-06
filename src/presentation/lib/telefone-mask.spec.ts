import { formatarTelefone } from "./telefone-mask";

describe("formatarTelefone", () => {
  it("formata progressivamente um fixo (10 dígitos)", () => {
    expect(formatarTelefone("1")).toBe("(1");
    expect(formatarTelefone("11")).toBe("(11");
    expect(formatarTelefone("113")).toBe("(11) 3");
    expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444");
  });

  it("formata progressivamente um celular (11 dígitos)", () => {
    expect(formatarTelefone("11999998888")).toBe("(11) 99999-8888");
  });

  it("ignora caracteres não numéricos já digitados (ex.: colar valor já mascarado)", () => {
    expect(formatarTelefone("(11) 99999-8888")).toBe("(11) 99999-8888");
  });

  it("trunca em 11 dígitos", () => {
    expect(formatarTelefone("119999988889999")).toBe("(11) 99999-8888");
  });

  it("string vazia devolve string vazia", () => {
    expect(formatarTelefone("")).toBe("");
  });
});

import { telefoneAceito, telefoneTemDdd } from "./telefone";

describe("telefoneAceito", () => {
  it("o número gravado passa como veio, mesmo sem DDD, em qualquer formatação", () => {
    expect(telefoneAceito("99999-0000", "999990000")).toBe(true);
  });

  it("número trocado, ou sem original (contato novo), é cobrado do DDD", () => {
    expect(telefoneAceito("88888-0000", "999990000")).toBe(false);
    expect(telefoneAceito("99999-0000")).toBe(false);
    expect(telefoneAceito("(11) 88888-0000", "999990000")).toBe(true);
  });
});

describe("telefoneTemDdd", () => {
  it.each(["11999990000", "(11) 99999-0000", "1133334444", "5511999990000", "+55 11 3333-4444"])(
    "aceita %s",
    (telefone) => {
      expect(telefoneTemDdd(telefone)).toBe(true);
    },
  );

  it.each(["", "-", "999990000", "33334444", "119999900001", "551199"])("recusa %p", (telefone) => {
    expect(telefoneTemDdd(telefone)).toBe(false);
  });
});

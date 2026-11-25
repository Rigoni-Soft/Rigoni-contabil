import {
  chaveDoTelefone,
  semNonoDigito,
  soDigitosNacionais,
  telefoneAceito,
  telefoneTemDdd,
} from "./telefone";

describe("semNonoDigito", () => {
  it.each([
    ["5545998480998", "554598480998"],
    ["554598480998", "554598480998"],
    ["554533221100", "554533221100"],
    ["11912345678", "11912345678"],
  ])("%s vira %s", (entrada, esperado) => {
    expect(semNonoDigito(entrada)).toBe(esperado);
  });
});

describe("soDigitosNacionais devolve o 9º dígito que o WhatsApp tira", () => {
  it.each([
    ["5545998480998", "45998480998"],
    ["554598480998", "45998480998"],
    ["4598480998", "45998480998"],
    ["(45) 9848-0998", "45998480998"],
    ["554533221100", "4533221100"],
    ["4533221100", "4533221100"],
  ])("%s vira %s", (entrada, esperado) => {
    expect(soDigitosNacionais(entrada)).toBe(esperado);
  });
});

describe("soDigitosNacionais", () => {
  it("devolve só os dígitos, sem o DDI 55 quando há mais de 11", () => {
    expect(soDigitosNacionais("+55 (61) 99999-0000")).toBe("61999990000");
    expect(soDigitosNacionais("(61) 99999-0000")).toBe("61999990000");
    expect(soDigitosNacionais("55999990000")).toBe("55999990000");
    expect(soDigitosNacionais("sem número")).toBe("");
  });
});

describe("chaveDoTelefone", () => {
  it("só dígitos e sem o DDI 55, como no banco", () => {
    expect(chaveDoTelefone("(11) 99999-0000")).toBe("11999990000");
    expect(chaveDoTelefone("+55 11 99999-0000")).toBe("11999990000");
    expect(chaveDoTelefone("5511999990000")).toBe("11999990000");
  });

  it("número de 11 dígitos que começa com 55 (DDD 55) não perde o prefixo; sem dígitos é null", () => {
    expect(chaveDoTelefone("55999990000")).toBe("55999990000");
    expect(chaveDoTelefone("  ")).toBeNull();
  });
});

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

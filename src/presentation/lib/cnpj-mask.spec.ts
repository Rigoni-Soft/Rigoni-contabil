import { formatarCnpj } from "./cnpj-mask";

describe("formatarCnpj", () => {
  it("formata progressivamente enquanto os dígitos chegam", () => {
    expect(formatarCnpj("1")).toBe("1");
    expect(formatarCnpj("11")).toBe("11");
    expect(formatarCnpj("114")).toBe("11.4");
    expect(formatarCnpj("11444777")).toBe("11.444.777");
    expect(formatarCnpj("114447770001")).toBe("11.444.777/0001");
    expect(formatarCnpj("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("ignora pontuação já digitada (ex.: colar valor já mascarado)", () => {
    expect(formatarCnpj("11.444.777/0001-61")).toBe("11.444.777/0001-61");
  });

  it("preserva letras do CNPJ alfanumérico (e as coloca em maiúsculas)", () => {
    expect(formatarCnpj("00000000e08g12")).toBe("00.000.000/E08G-12");
    expect(formatarCnpj("00.000.000/E08")).toBe("00.000.000/E08");
  });

  it("trunca em 14 dígitos", () => {
    expect(formatarCnpj("114447770001619999")).toBe("11.444.777/0001-61");
  });
});

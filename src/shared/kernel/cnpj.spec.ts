import { cnpjValido, normalizarCnpj } from "./cnpj";

describe("normalizarCnpj", () => {
  it("remove pontuação e coloca letras em maiúsculas, sem perder nenhuma", () => {
    expect(normalizarCnpj("00.000.000/e08g-12")).toBe("00000000E08G12");
    expect(normalizarCnpj("11.444.777/0001-61")).toBe("11444777000161");
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ numérico legado, com ou sem pontuação", () => {
    expect(cnpjValido("11.444.777/0001-61")).toBe(true);
    expect(cnpjValido("11444777000161")).toBe(true);
  });

  it("aceita o CNPJ alfanumérico oficial de exemplo, em maiúsculas ou minúsculas", () => {
    expect(cnpjValido("00.000.000/E08G-12")).toBe(true);
    expect(cnpjValido("00.000.000/e08g-12")).toBe(true);
  });

  it("rejeita CNPJ alfanumérico com dígito verificador inválido", () => {
    expect(cnpjValido("00.000.000/E08G-13")).toBe(false);
  });

  it("rejeita letra nos dígitos verificadores", () => {
    expect(cnpjValido("00.000.000/E08G-1A")).toBe(false);
  });

  it("rejeita dígito verificador incorreto, tamanho errado e caracteres repetidos", () => {
    expect(cnpjValido("01.010.101/0101-01")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

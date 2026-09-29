import { cnpjValido } from "./cnpj-validation";

describe("cnpjValido", () => {
  it("aceita um CNPJ com dígito verificador correto", () => {
    expect(cnpjValido("11.444.777/0001-61")).toBe(true);
    expect(cnpjValido("11444777000161")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(cnpjValido("01.010.101/0101-01")).toBe(false);
  });

  it("rejeita quantidade errada de dígitos", () => {
    expect(cnpjValido("123")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

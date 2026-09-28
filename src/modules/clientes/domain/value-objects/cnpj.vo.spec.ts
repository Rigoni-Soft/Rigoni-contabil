import { Cnpj } from "./cnpj.vo";

describe("Cnpj", () => {
  it("cria a partir de um CNPJ válido, com ou sem pontuação", () => {
    const semPontuacao = Cnpj.criar("11444777000161");
    const comPontuacao = Cnpj.criar("11.444.777/0001-61");

    expect(semPontuacao.ok).toBe(true);
    expect(comPontuacao.ok).toBe(true);
    if (semPontuacao.ok) expect(semPontuacao.value.digitos).toBe("11444777000161");
    if (comPontuacao.ok) expect(comPontuacao.value.digitos).toBe("11444777000161");
  });

  it("rejeita dígitos verificadores errados", () => {
    const resultado = Cnpj.criar("11444777000162");

    expect(resultado.ok).toBe(false);
  });

  it("rejeita quantidade de dígitos diferente de 14", () => {
    const resultado = Cnpj.criar("1234");

    expect(resultado.ok).toBe(false);
  });

  it("rejeita todos os dígitos iguais, mesmo que passasse no cálculo", () => {
    const resultado = Cnpj.criar("00000000000000");

    expect(resultado.ok).toBe(false);
  });
});

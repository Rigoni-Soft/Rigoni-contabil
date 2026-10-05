import { Cnpj } from "./cnpj.vo";

describe("Cnpj", () => {
  it("cria a partir de um CNPJ numérico válido, com ou sem pontuação", () => {
    const semPontuacao = Cnpj.criar("11444777000161");
    const comPontuacao = Cnpj.criar("11.444.777/0001-61");

    expect(semPontuacao.ok && semPontuacao.value.valor).toBe("11444777000161");
    expect(comPontuacao.ok && comPontuacao.value.valor).toBe("11444777000161");
  });

  it("cria a partir do CNPJ alfanumérico oficial, preservando as letras em maiúsculas", () => {
    const resultado = Cnpj.criar("00.000.000/e08g-12");

    expect(resultado.ok && resultado.value.valor).toBe("00000000E08G12");
  });

  it.each([
    ["dígitos verificadores errados", "11444777000162"],
    ["alfanumérico com DV inválido", "00.000.000/E08G-13"],
    ["quantidade de caracteres diferente de 14", "1234"],
    ["todos os caracteres iguais", "00000000000000"],
  ])("rejeita %s", (_, entrada) => {
    expect(Cnpj.criar(entrada).ok).toBe(false);
  });
});

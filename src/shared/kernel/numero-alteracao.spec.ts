import { erroDoNumero, numeroDoNomeDoArquivo, sugerirNumero } from "./numero-alteracao";

describe("numeroDoNomeDoArquivo", () => {
  it.each([
    ["2-alteracao.pdf", 2],
    ["03_alteracao social.pdf", 3],
    ["12 contrato.docx", 12],
    ["4.pdf", 4],
  ])("lê o prefixo de %s", (nome, esperado) => {
    expect(numeroDoNomeDoArquivo(nome)).toBe(esperado);
  });

  it.each(["alteracao.pdf", "alteracao-2.pdf", "0-alteracao.pdf", "1234567890-alteracao.pdf", ""])(
    "devolve null sem prefixo numérico válido em %j",
    (nome) => {
      expect(numeroDoNomeDoArquivo(nome)).toBeNull();
    },
  );
});

describe("sugerirNumero", () => {
  it("usa o prefixo do arquivo quando há", () => {
    expect(sugerirNumero("5-alteracao.pdf", [1, 2])).toBe(5);
  });

  it("sem prefixo, sugere o maior nº + 1", () => {
    expect(sugerirNumero("alteracao.pdf", [1, 4, 2])).toBe(5);
  });

  it("sem prefixo e sem outras alterações, sugere 1", () => {
    expect(sugerirNumero("alteracao.pdf", [])).toBe(1);
  });
});

describe("erroDoNumero", () => {
  it("aceita nº inteiro positivo e inédito", () => {
    expect(erroDoNumero(3, [1, 2])).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN, 1_000_000_000])("recusa %s", (numero) => {
    expect(erroDoNumero(numero, [])).toBe("Informe um nº inteiro de 1 a 999999999");
  });

  it("recusa nº repetido", () => {
    expect(erroDoNumero(2, [1, 2])).toBe("Já existe a alteração nº 2");
  });
});

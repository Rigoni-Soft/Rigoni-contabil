import {
  divergenciaNumeroData,
  erroDeDuplicidade,
  erroDeFormato,
  numeroDoNomeDoArquivo,
  outrosNumeros,
  sugerirNumero,
} from "./numero-alteracao";

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

describe("erroDeFormato", () => {
  it("aceita nº inteiro de 1 ao teto", () => {
    expect(erroDeFormato(3)).toBeNull();
    expect(erroDeFormato(999_999_999)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN, 1_000_000_000])("recusa %s", (numero) => {
    expect(erroDeFormato(numero)).toBe("Informe um nº inteiro de 1 a 999999999");
  });
});

describe("outrosNumeros", () => {
  it("devolve os nºs das demais alterações", () => {
    expect(outrosNumeros([{ numero: 1 }, { numero: 2 }, { numero: 3 }], 1)).toEqual([1, 3]);
  });
});

describe("erroDeDuplicidade", () => {
  it("aceita nº inédito", () => {
    expect(erroDeDuplicidade(3, [1, 2])).toBeNull();
  });

  it("recusa nº repetido", () => {
    expect(erroDeDuplicidade(2, [1, 2])).toBe("Já existe a alteração nº 2");
  });
});

describe("divergenciaNumeroData", () => {
  const outras = [
    { numero: 1, data: "2026-01-10" },
    { numero: 2, data: "2026-03-10" },
  ];

  it("devolve o maior nº menor cuja data é posterior", () => {
    expect(divergenciaNumeroData({ numero: 3, data: "2026-02-01" }, outras)).toBe(2);
  });

  it("não aponta divergência quando a ordem bate", () => {
    expect(divergenciaNumeroData({ numero: 3, data: "2026-04-01" }, outras)).toBeNull();
  });

  it("ignora alterações de nº maior", () => {
    expect(divergenciaNumeroData({ numero: 1, data: "2026-01-01" }, [outras[1]])).toBeNull();
  });
});

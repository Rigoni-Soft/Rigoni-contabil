import { AlteracaoContratual } from "./alteracao-contratual.vo";

describe("AlteracaoContratual", () => {
  it("cria uma alteração válida", () => {
    const resultado = AlteracaoContratual.criar(2, "2026-01-15", "clientes/1/alteracoes/2-doc.pdf");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.data).toEqual(new Date("2026-01-15"));
      expect(resultado.value.numero).toBe(2);
      expect(resultado.value.arquivoCaminho).toBe("clientes/1/alteracoes/2-doc.pdf");
    }
  });

  it("rejeita data inválida", () => {
    const resultado = AlteracaoContratual.criar(
      1,
      "não é uma data",
      "clientes/1/alteracoes/1-doc.pdf",
    );

    expect(resultado.ok).toBe(false);
  });

  it("rejeita caminho de arquivo vazio", () => {
    const resultado = AlteracaoContratual.criar(1, "2026-01-15", "");

    expect(resultado.ok).toBe(false);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejeita nº %s", (numero) => {
    const resultado = AlteracaoContratual.criar(numero, "2026-01-15", "doc.pdf");

    expect(resultado.ok).toBe(false);
  });
});

import { Regime } from "./regime.vo";

describe("Regime", () => {
  it("cria um regime válido", () => {
    const resultado = Regime.criar("simples_nacional");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.valor).toBe("simples_nacional");
  });

  it("rejeita um regime desconhecido", () => {
    const resultado = Regime.criar("lucro_arbitrado");

    expect(resultado.ok).toBe(false);
  });
});

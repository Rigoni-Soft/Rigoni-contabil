import { regimeTemCadastroOperacionalSn } from "./regimes";

describe("regimeTemCadastroOperacionalSn", () => {
  it.each([
    ["simples_nacional", true],
    ["mei", true],
    ["lucro_presumido", false],
    ["lucro_real", false],
  ])("%s → %s", (regime, esperado) => {
    expect(regimeTemCadastroOperacionalSn(regime)).toBe(esperado);
  });
});

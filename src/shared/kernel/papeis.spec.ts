import { podeGerirParcelamento, podeVerDashboardDoSetor } from "./papeis";

describe("podeVerDashboardDoSetor", () => {
  it.each([
    ["admin", "administrativo", "rh", true],
    ["lider_setor", "rh", "rh", true],
    ["funcionario", "rh", "rh", true],
    ["funcionario", "simples_nacional", "rh", false],
    ["lider_setor", "rh", "simples_nacional", false],
  ])("%s do setor %s vendo o dashboard de %s: %s", (papel, setorDoAtor, setor, esperado) => {
    expect(podeVerDashboardDoSetor(papel, setorDoAtor, setor)).toBe(esperado);
  });
});

describe("podeGerirParcelamento", () => {
  it.each([
    ["admin", "administrativo", "rh", true],
    ["lider_setor", "rh", "rh", true],
    ["funcionario", "rh", "rh", true],
    ["funcionario", "simples_nacional", "rh", false],
    ["lider_setor", "rh", "simples_nacional", false],
  ])("%s do setor %s gerindo o Parcelamento de %s: %s", (papel, setorDoAtor, setor, esperado) => {
    expect(podeGerirParcelamento(papel, setorDoAtor, setor)).toBe(esperado);
  });
});

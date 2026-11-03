import {
  podeGerirParcelamento,
  podeVerComparativoDoSetor,
  podeVerDashboardDoSetor,
  soLeDadosBasicosDoCliente,
  veCarteiraInteira,
} from "./papeis";

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

describe("soLeDadosBasicosDoCliente", () => {
  it.each([
    ["lider_setor", "rh", true],
    ["funcionario", "rh", true],
    ["admin", "administrativo", false],
    ["funcionario", "simples_nacional", false],
  ])("%s do setor %s lê só os dados básicos: %s", (papel, setor, esperado) => {
    expect(soLeDadosBasicosDoCliente(papel, setor)).toBe(esperado);
  });
});

describe("podeVerComparativoDoSetor", () => {
  it.each([
    ["lider_setor", "rh", true],
    ["lider_setor", "recepcao", false],
    ["funcionario", "rh", false],
    ["admin", "administrativo", false],
  ])("%s do setor %s vê o comparativo: %s", (papel, setor, esperado) => {
    expect(podeVerComparativoDoSetor(papel, setor)).toBe(esperado);
  });
});

describe("veCarteiraInteira", () => {
  it.each([
    ["admin", true],
    ["lider_setor", true],
    ["funcionario", false],
  ])("%s vê a carteira inteira: %s", (papel, esperado) => {
    expect(veCarteiraInteira(papel)).toBe(esperado);
  });
});

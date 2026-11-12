import {
  ehResponsavelRhDoCliente,
  podeEditarCadastroRh,
  podeGerirConvencaoRh,
  podeGerirParcelamento,
  podeOperarParcelamento,
  podeVerComparativoDoSetor,
  podeVerDashboardDoSetor,
  usaCadastroDoRh,
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

describe("podeOperarParcelamento", () => {
  it.each([
    ["admin", "administrativo", true],
    ["lider_setor", "simples_nacional", true],
    ["funcionario", "rh", true],
    ["funcionario", "financeiro", false],
    ["lider_setor", "pessoal", false],
  ])("%s do setor %s lê o PDF e mexe nas guias: %s", (papel, setor, esperado) => {
    expect(podeOperarParcelamento(papel, setor)).toBe(esperado);
  });
});

describe("usaCadastroDoRh", () => {
  it.each([
    ["lider_setor", "rh", true],
    ["funcionario", "rh", true],
    ["admin", "administrativo", false],
    ["funcionario", "simples_nacional", false],
  ])("%s do setor %s usa o cadastro do RH: %s", (papel, setor, esperado) => {
    expect(usaCadastroDoRh(papel, setor)).toBe(esperado);
  });
});

describe("podeEditarCadastroRh", () => {
  it.each([
    ["admin", "administrativo", true],
    ["lider_setor", "rh", true],
    ["funcionario", "rh", true],
    ["funcionario", "simples_nacional", false],
    ["lider_setor", "financeiro", false],
  ])("%s do setor %s edita o cadastro do RH: %s", (papel, setor, esperado) => {
    expect(podeEditarCadastroRh(papel, setor)).toBe(esperado);
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
    ["papel_novo", false],
  ])("%s vê a carteira inteira: %s", (papel, esperado) => {
    expect(veCarteiraInteira(papel)).toBe(esperado);
  });
});

describe("podeGerirConvencaoRh", () => {
  it.each([
    ["admin", "sn", true],
    ["lider_setor", "rh", true],
    ["lider_setor", "sn", false],
    ["funcionario", "rh", false],
  ])("%s do setor %s: %s", (papel, setor, esperado) => {
    expect(podeGerirConvencaoRh(papel, setor)).toBe(esperado);
  });
});

describe("ehResponsavelRhDoCliente", () => {
  it.each([
    ["funcionario", "rh", "u1", true],
    ["funcionario", "rh", "u2", false],
    ["funcionario", "rh", null, false],
    ["funcionario", "sn", "u1", false],
    ["lider_setor", "rh", "u1", false],
    ["admin", "rh", "u1", false],
  ])("%s do setor %s, Responsável %s: %s", (papel, setor, responsavelId, esperado) => {
    expect(ehResponsavelRhDoCliente({ id: "u1", papel, setor }, responsavelId)).toBe(esperado);
  });
});

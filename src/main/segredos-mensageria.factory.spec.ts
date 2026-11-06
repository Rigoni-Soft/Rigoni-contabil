import {
  exigirSegredosReais,
  pedeAdapterFalsoDoE2E,
  SEGREDOS_MENSAGERIA_PLACEHOLDER,
} from "./segredos-mensageria.factory";

const reais = { assinatura: "a1b2c3", tokenVerificacao: "d4e5f6", sessao: "g7h8i9" };

describe("exigirSegredosReais", () => {
  it("em produção com os três segredos reais não lança", () => {
    expect(() => exigirSegredosReais(reais, true)).not.toThrow();
  });

  it("em produção com os placeholders lança e nomeia todos", () => {
    expect(() => exigirSegredosReais(SEGREDOS_MENSAGERIA_PLACEHOLDER, true)).toThrow(
      /assinatura, tokenVerificacao, sessao/,
    );
  });

  it("em produção com um único placeholder lança", () => {
    expect(() =>
      exigirSegredosReais({ ...reais, sessao: SEGREDOS_MENSAGERIA_PLACEHOLDER.sessao }, true),
    ).toThrow(/sessao/);
  });

  it("fora de produção os placeholders continuam valendo", () => {
    expect(() => exigirSegredosReais(SEGREDOS_MENSAGERIA_PLACEHOLDER, false)).not.toThrow();
  });
});

describe("pedeAdapterFalsoDoE2E", () => {
  const segredo = "segredo-e2e-com-16-ou-mais";

  it("aceita só o valor exato do segredo configurado", () => {
    expect(pedeAdapterFalsoDoE2E(segredo, segredo)).toBe(true);
    expect(pedeAdapterFalsoDoE2E(segredo, "outro-valor-qualquer-aqui")).toBe(false);
    expect(pedeAdapterFalsoDoE2E(segredo, `${segredo}x`)).toBe(false);
  });

  it("sem segredo configurado ou sem cabeçalho nunca aceita", () => {
    expect(pedeAdapterFalsoDoE2E(undefined, "qualquer")).toBe(false);
    expect(pedeAdapterFalsoDoE2E("", "")).toBe(false);
    expect(pedeAdapterFalsoDoE2E(segredo, null)).toBe(false);
  });
});

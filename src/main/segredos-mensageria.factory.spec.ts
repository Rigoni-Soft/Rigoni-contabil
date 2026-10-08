import {
  exigirSegredosReais,
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

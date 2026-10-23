import { resumoDoAcordo } from "./editar-cadastro-operacional.presenter";

describe("resumoDoAcordo", () => {
  it("junta órgão, parcelas, valor e data de adesão, na ordem", () => {
    expect(
      resumoDoAcordo({
        origem: "receita_federal",
        totalDeParcelas: 7,
        valorDaParcelaCentavos: 31620,
        dataDeAdesao: "2026-08-27",
      }),
    ).toMatch(/^Receita Federal · 7 parcelas · R\$\s316,20 · adesão 27\/08\/2026$/);
  });

  it("omite o que o PDF não trouxe; uma parcela fica no singular", () => {
    expect(
      resumoDoAcordo({
        origem: "pgfn",
        totalDeParcelas: 1,
        valorDaParcelaCentavos: null,
        dataDeAdesao: null,
      }),
    ).toBe("PGFN · 1 parcela");
  });

  it.each([
    [undefined],
    [{ origem: null, totalDeParcelas: null, valorDaParcelaCentavos: null, dataDeAdesao: null }],
  ])("sem nenhum dado, nenhum resumo (%j)", (acordo) => {
    expect(resumoDoAcordo(acordo)).toBe("");
  });
});

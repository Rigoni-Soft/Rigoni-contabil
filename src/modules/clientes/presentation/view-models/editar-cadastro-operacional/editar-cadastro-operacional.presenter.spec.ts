import { leituraDaLinha, resumoDoAcordo } from "./editar-cadastro-operacional.presenter";

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

describe("leituraDaLinha", () => {
  it("lendo: o texto nomeia a operação", () => {
    expect(leituraDaLinha({ estado: "lendo" })).toEqual({ estado: "lendo", texto: "Lendo o PDF…" });
  });

  it("sugerido: pede para conferir; sem código no PDF, diz que o sistema gerou um", () => {
    expect(leituraDaLinha({ estado: "sugerido", codigoGerado: false, cnpjConfere: true })).toEqual({
      estado: "sugerido",
      texto: "Sugerido pelo PDF: confira",
      cnpjDivergente: false,
    });
    expect(
      leituraDaLinha({ estado: "sugerido", codigoGerado: true, cnpjConfere: null }).texto,
    ).toBe("Sugerido pelo PDF: confira. O PDF não traz código: gerei um, você pode trocar.");
  });

  it.each([
    [true, false],
    [null, false],
    [false, true],
  ])("CNPJ confere = %s: divergente = %s (só o false avisa)", (cnpjConfere, divergente) => {
    expect(
      leituraDaLinha({ estado: "sugerido", codigoGerado: false, cnpjConfere }).cnpjDivergente,
    ).toBe(divergente);
  });

  it("falhou: manda digitar à mão", () => {
    expect(leituraDaLinha({ estado: "falhou" })).toEqual({
      estado: "falhou",
      texto: "não consegui ler: digite à mão",
    });
  });
});

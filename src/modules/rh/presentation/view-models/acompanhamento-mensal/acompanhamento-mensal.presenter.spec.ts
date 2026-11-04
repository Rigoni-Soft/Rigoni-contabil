import { linhasDaTabela, mesesParaSeletor, rotuloDaCompetencia } from "./acompanhamento-mensal.presenter";

describe("acompanhamento-mensal.presenter", () => {
  it("rotula a competência por extenso", () => {
    expect(rotuloDaCompetencia("2026-03")).toBe("março de 2026");
  });

  it("lista os meses do corrente para trás, virando o ano", () => {
    const meses = mesesParaSeletor("2026-02", 3).map((m) => m.valor);
    expect(meses).toEqual(["2026-02", "2026-01", "2025-12"]);
  });

  it("conta pendentes só entre os serviços que se aplicam e não são do sistema", () => {
    const [linha] = linhasDaTabela({
      competencia: "2026-11",
      podeMarcar: true,
      podeGerirServicos: false,
      servicos: [
        { id: "a", nome: "FGTS", sistema: false },
        { id: "b", nome: "SIB", sistema: false },
        { id: "c", nome: "NUTRI", sistema: false },
        { id: "h", nome: "Holerite", sistema: true },
      ],
      linhas: [
        {
          clienteId: "c1",
          empresa: "Alfa",
          cnpj: "1",
          celulas: [
            { servicoId: "a", aplica: true, concluido: true },
            { servicoId: "b", aplica: false, concluido: false },
            { servicoId: "c", aplica: true, concluido: false },
            { servicoId: "h", aplica: true, concluido: false },
          ],
        },
      ],
    });

    expect(linha.pendentes).toBe(1);
    expect(linha.celulas.map((c) => c.editavel)).toEqual([true, true, true, false]);
  });
});

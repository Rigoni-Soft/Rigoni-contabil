import { linhasDaTabela, mesVizinho, rotuloDaCompetencia } from "./acompanhamento-mensal.presenter";

describe("acompanhamento-mensal.presenter", () => {
  it("rotula a competência por extenso", () => {
    expect(rotuloDaCompetencia("2026-03")).toBe("março de 2026");
  });

  it("acha o mês vizinho, virando o ano", () => {
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
    expect(mesVizinho("2025-12", 1)).toBe("2026-01");
    expect(mesVizinho("2026-05", -1)).toBe("2026-04");
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

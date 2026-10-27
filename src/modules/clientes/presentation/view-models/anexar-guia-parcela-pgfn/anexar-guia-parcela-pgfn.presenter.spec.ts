import {
  competenciaDoMes,
  competenciaEmFalta,
  idDaGuia,
} from "./anexar-guia-parcela-pgfn.presenter";

describe("competenciaDoMes", () => {
  it.each([
    ["2026-10", "202610"],
    ["10/2026", "202610"],
    [" 3/2026 ", "202603"],
    ["", ""],
  ])("%p vira %p", (entrada, esperado) => {
    expect(competenciaDoMes(entrada)).toBe(esperado);
  });

  it("forma desconhecida passa como está (o schema recusa)", () => {
    expect(competenciaDoMes("outubro")).toBe("outubro");
  });
});

it("idDaGuia junta o prefixo da região e a competência", () => {
  expect(idDaGuia("guias-p1", "202610")).toBe("guias-p1-guia-202610");
});

describe("competenciaEmFalta", () => {
  // 27/10/2026 em São Paulo: mês corrente 202610.
  const agora = new Date("2026-10-27T15:00:00Z");
  const guia = (competencia: string) => ({
    competencia,
    contaNegociacao: "1",
    estado: "confirmada" as const,
  });

  it("sem nenhuma guia, não avisa (a lista já diz que não há)", () => {
    expect(competenciaEmFalta([], agora)).toBeUndefined();
  });

  it("com a guia do mês anexada, não avisa", () => {
    expect(competenciaEmFalta([guia("202609"), guia("202610")], agora)).toBeUndefined();
  });

  it("com guias só de meses anteriores, avisa qual falta", () => {
    expect(competenciaEmFalta([guia("202609")], agora)).toBe("10/2026");
  });
});

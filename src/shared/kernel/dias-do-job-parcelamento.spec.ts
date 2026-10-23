import { primeiroDiaEmAtraso } from "./dias-do-job-parcelamento";

describe("primeiroDiaEmAtraso", () => {
  it.each([
    ["2026-10-15T15:00:00Z", 29], // mês de 31 dias: depois da rodada do dia 28
    ["2026-04-15T15:00:00Z", 29], // 30 dias
    ["2028-02-15T15:00:00Z", 29], // fevereiro bissexto: o dia 29 existe
    ["2026-02-15T15:00:00Z", 28], // fevereiro comum: o atraso começa no último dia
  ])("%s → dia %i", (instante, esperado) => {
    expect(primeiroDiaEmAtraso(new Date(instante))).toBe(esperado);
  });
});

import {
  diaDoMes,
  hojeIso,
  mesAnterior,
  mesAtual,
  primeiroDiaDoMesAtual,
  ultimoDiaDoMes,
} from "./mes-atual";

describe("mesAtual (America/Sao_Paulo)", () => {
  it("ainda é o mês anterior em Brasília quando UTC já virou o mês", () => {
    const instante = new Date("2026-11-01T01:00:00Z"); // 31/10 22:00 em Brasília
    expect(instante.toISOString().slice(0, 7)).toBe("2026-11");
    expect(mesAtual(instante)).toBe("2026-10");
    expect(primeiroDiaDoMesAtual(instante)).toBe("2026-10-01");
  });

  it("vira o mês junto com Brasília", () => {
    expect(mesAtual(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });

  describe("hojeIso e diaDoMes", () => {
    it("usam o dia de São Paulo, não o de UTC (02/10 01:00 UTC ainda é 01/10 em Brasília)", () => {
      const agora = new Date("2026-10-02T01:00:00Z");
      expect(hojeIso(agora)).toBe("2026-10-01");
      expect(diaDoMes(agora)).toBe(1);
    });
  });

  describe("ultimoDiaDoMes", () => {
    it.each([
      ["2026-10-15T15:00:00Z", 31],
      ["2026-04-15T15:00:00Z", 30],
      ["2026-02-15T15:00:00Z", 28],
      ["2028-02-15T15:00:00Z", 29], // bissexto
    ])("%s → %i", (instante, esperado) => {
      expect(ultimoDiaDoMes(new Date(instante))).toBe(esperado);
    });

    it("usa o mês de São Paulo (01/03 01:00 UTC ainda é fevereiro em Brasília)", () => {
      expect(ultimoDiaDoMes(new Date("2026-03-01T01:00:00Z"))).toBe(28);
    });
  });
});

describe("mesAnterior", () => {
  it.each([
    ["2026-10-20T15:00:00Z", "202609"],
    ["2026-01-15T15:00:00Z", "202512"], // vira o ano
    ["2026-02-01T01:00:00Z", "202512"], // 31/01 22:00 em Brasília: o corrente ainda é janeiro
  ])("%s → %s", (instante, esperado) => {
    expect(mesAnterior(new Date(instante))).toBe(esperado);
  });
});

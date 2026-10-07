import { mesAtual, primeiroDiaDoMesAtual } from "./mes-atual";

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
});

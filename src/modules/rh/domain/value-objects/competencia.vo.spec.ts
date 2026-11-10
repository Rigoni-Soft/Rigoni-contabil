import { Competencia } from "./competencia.vo";

describe("Competencia", () => {
  it.each(["2026-11", "2026-01", "2026-12"])("aceita %s", (entrada) => {
    const r = Competencia.criar(entrada);
    expect(r.ok && r.value.valor).toBe(entrada);
  });

  it.each(["2026-13", "2026-00", "2026-1", "202611", "2026-11-01", ""])(
    "recusa '%s'",
    (entrada) => {
      expect(Competencia.criar(entrada).ok).toBe(false);
    },
  );

  it("guarda o primeiro dia do mês", () => {
    const r = Competencia.criar("2026-11");
    expect(r.ok && r.value.primeiroDia).toBe("2026-11-01");
  });

  it("é futura só depois do mês corrente no fuso do escritório", () => {
    // 01/12 01:00 UTC ainda é 30/11 em Brasília.
    const agora = new Date("2026-12-01T01:00:00Z");
    const nov = Competencia.criar("2026-11");
    const dez = Competencia.criar("2026-12");
    expect(nov.ok && nov.value.ehFutura(agora)).toBe(false);
    expect(dez.ok && dez.value.ehFutura(agora)).toBe(true);
  });

  it("ultimosMeses devolve os meses terminados no da competência, do mais antigo ao mais novo, atravessando o ano", () => {
    const jan = Competencia.criar("2026-01");
    expect(jan.ok && jan.value.ultimosMeses(3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("atual usa o mês do fuso do escritório", () => {
    expect(Competencia.atual(new Date("2026-12-01T01:00:00Z")).valor).toBe("2026-11");
  });
});

import {
  avisoDeFechado,
  estaAbertoEm,
  feriadosNacionais,
  proximaAbertura,
} from "./expediente.service";

// Instantes escritos em horário de São Paulo (UTC-3, sem horário de verão).
const sp = (isoLocal: string) => new Date(`${isoLocal}-03:00`);
const SEM_EXTRAS: ReadonlySet<string> = new Set();

describe("feriadosNacionais", () => {
  it("inclui fixos e móveis de 2026", () => {
    const f = feriadosNacionais(2026);
    expect(f).toEqual(
      expect.arrayContaining([
        "2026-01-01", // Confraternização
        "2026-02-16", // Carnaval (segunda)
        "2026-02-17", // Carnaval (terça)
        "2026-04-03", // Sexta-feira Santa
        "2026-04-21",
        "2026-05-01",
        "2026-06-04", // Corpus Christi
        "2026-09-07",
        "2026-10-12",
        "2026-11-02",
        "2026-11-15",
        "2026-11-20",
        "2026-12-25",
      ]),
    );
  });

  it("calcula a Páscoa de outro ano (2027: Sexta-feira Santa em 26/03)", () => {
    expect(feriadosNacionais(2027)).toContain("2027-03-26");
  });
});

describe("estaAbertoEm", () => {
  it.each([
    ["2026-10-07T07:59:00", false], // quarta, 1 min antes
    ["2026-10-07T08:00:00", true],
    ["2026-10-07T17:59:00", true],
    ["2026-10-07T18:00:00", false],
    ["2026-10-09T17:59:00", true], // sexta
    ["2026-10-09T18:00:00", false], // sexta à noite
    ["2026-10-10T10:00:00", false], // sábado
    ["2026-10-11T10:00:00", false], // domingo
    ["2026-10-12T10:00:00", false], // feriado nacional (segunda)
    ["2026-10-13T08:00:00", true], // dia útil após o feriado
    ["2026-10-14T07:59:00", false],
  ])("%s → %s", (instante, aberto) => {
    expect(estaAbertoEm(sp(instante), SEM_EXTRAS)).toBe(aberto);
  });

  it("véspera útil de feriado fecha às 18h e só reabre no dia útil após o feriado", () => {
    // 2026-09-07 (segunda) é feriado; sexta 04/09 18h → terça 08/09 8h.
    expect(estaAbertoEm(sp("2026-09-04T17:59:00"), SEM_EXTRAS)).toBe(true);
    expect(estaAbertoEm(sp("2026-09-04T18:00:00"), SEM_EXTRAS)).toBe(false);
    expect(estaAbertoEm(sp("2026-09-08T07:59:00"), SEM_EXTRAS)).toBe(false);
    expect(estaAbertoEm(sp("2026-09-08T08:00:00"), SEM_EXTRAS)).toBe(true);
  });

  it("sexta às 18h até segunda às 8h (fim de semana sem feriado)", () => {
    // 2026-10-19 é segunda comum.
    expect(estaAbertoEm(sp("2026-10-16T18:00:00"), SEM_EXTRAS)).toBe(false);
    expect(estaAbertoEm(sp("2026-10-19T07:59:00"), SEM_EXTRAS)).toBe(false);
    expect(estaAbertoEm(sp("2026-10-19T08:00:00"), SEM_EXTRAS)).toBe(true);
  });

  it("véspera de feriado cadastrado no meio da semana fecha às 18h e reabre depois dele", () => {
    const extras = new Set(["2026-10-22"]); // quinta
    expect(estaAbertoEm(sp("2026-10-21T17:59:00"), extras)).toBe(true);
    expect(estaAbertoEm(sp("2026-10-21T18:00:00"), extras)).toBe(false);
    expect(estaAbertoEm(sp("2026-10-23T07:59:00"), extras)).toBe(false);
    expect(estaAbertoEm(sp("2026-10-23T08:00:00"), extras)).toBe(true);
  });

  it("feriado cadastrado vale como feriado", () => {
    const extras = new Set(["2026-10-08"]);
    expect(estaAbertoEm(sp("2026-10-08T10:00:00"), extras)).toBe(false);
    expect(estaAbertoEm(sp("2026-10-08T10:00:00"), SEM_EXTRAS)).toBe(true);
  });

  it("usa o fuso de São Paulo, não o UTC (21h UTC de quarta = 18h em SP)", () => {
    expect(estaAbertoEm(new Date("2026-10-07T20:59:00Z"), SEM_EXTRAS)).toBe(true);
    expect(estaAbertoEm(new Date("2026-10-07T21:00:00Z"), SEM_EXTRAS)).toBe(false);
  });
});

describe("proximaAbertura", () => {
  it("antes das 8h de dia útil: hoje", () => {
    expect(proximaAbertura(sp("2026-10-07T06:00:00"), SEM_EXTRAS)).toBe("2026-10-07");
  });
  it("depois das 18h: próximo dia útil", () => {
    expect(proximaAbertura(sp("2026-10-07T19:00:00"), SEM_EXTRAS)).toBe("2026-10-08");
  });
  it("sexta à noite: segunda", () => {
    expect(proximaAbertura(sp("2026-10-09T19:00:00"), SEM_EXTRAS)).toBe("2026-10-13"); // 12/10 é feriado
  });
  it("feriado cadastrado empurra para o dia útil seguinte", () => {
    expect(proximaAbertura(sp("2026-10-07T19:00:00"), new Set(["2026-10-08"]))).toBe("2026-10-09");
  });
});

describe("avisoDeFechado", () => {
  it("diz hoje às 8h quando abre no mesmo dia", () => {
    expect(avisoDeFechado(sp("2026-10-07T06:00:00"), SEM_EXTRAS)).toMatch(/hoje.*8h/);
  });
  it("diz amanhã às 8h", () => {
    expect(avisoDeFechado(sp("2026-10-07T19:00:00"), SEM_EXTRAS)).toMatch(/amanhã.*8h/);
  });
  it("sexta à noite: dia da semana e data", () => {
    expect(avisoDeFechado(sp("2026-10-09T19:00:00"), SEM_EXTRAS)).toMatch(
      /terça-feira, 13\/10.*8h/,
    );
  });
  it("não mostra menu", () => {
    expect(avisoDeFechado(sp("2026-10-07T19:00:00"), SEM_EXTRAS)).not.toMatch(/menu/i);
  });
});

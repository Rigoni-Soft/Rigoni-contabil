import { jaEmAtraso, primeiroDiaEmAtraso } from "./dias-do-job-parcelamento";

describe("primeiroDiaEmAtraso", () => {
  it.each([
    ["2026-10-15T15:00:00Z", 29],
    ["2026-04-15T15:00:00Z", 29],
    ["2028-02-15T15:00:00Z", 29],
    ["2026-02-15T15:00:00Z", 28],
  ])("%s → dia %i", (instante, esperado) => {
    expect(primeiroDiaEmAtraso(new Date(instante))).toBe(esperado);
  });
});

describe("jaEmAtraso", () => {
  it.each([
    ["2026-10-28T15:00:00Z", false],
    ["2026-10-29T15:00:00Z", true],
    ["2026-02-27T15:00:00Z", false],
    ["2026-02-28T15:00:00Z", true],
  ])("%s → %s", (instante, esperado) => {
    expect(jaEmAtraso(new Date(instante))).toBe(esperado);
  });
});

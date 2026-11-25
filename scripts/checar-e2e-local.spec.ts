/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Entrada = {
  statusPlaywright: number;
  errosGlobais: unknown[];
  stats: { expected: number; skipped: number };
  vermelhos: number;
  reais: number;
};

const MODULO = pathToFileURL(resolve(".claude/scripts/veredito-e2e.mjs")).href;

// Relatório sintético do Playwright: status 0, sem erro global, sem vermelho; só varia o stats.
const base: Entrada = {
  statusPlaywright: 0,
  errosGlobais: [],
  stats: { expected: 3, skipped: 0 },
  vermelhos: 0,
  reais: 0,
};

const veredito = (entrada: Entrada) => {
  const codigo = `import(process.argv[1]).then((m) => console.log(JSON.stringify(m.veredito(JSON.parse(process.argv[2])))))`;
  const r = spawnSync(process.execPath, ["-e", codigo, MODULO, JSON.stringify(entrada)], {
    encoding: "utf8",
  });
  return JSON.parse(r.stdout) as { codigo: number; motivo: string };
};

describe("veredito do check:e2e-local", () => {
  it("verde com testes aprovados e nenhum skipped", () => {
    expect(veredito(base).codigo).toBe(0);
  });

  it("falha quando o relatório válido não executou nenhum teste (expected 0, skipped > 0)", () => {
    const v = veredito({ ...base, stats: { expected: 0, skipped: 4 } });
    expect(v.codigo).toBe(1);
    expect(v.motivo).toContain("nenhum teste");
  });

  it("falha quando o relatório não contabiliza teste algum", () => {
    expect(veredito({ ...base, stats: { expected: 0, skipped: 0 } }).codigo).toBe(1);
  });

  it("cobertura parcial (2), nunca verde, quando há aprovados mas também skipped", () => {
    expect(veredito({ ...base, stats: { expected: 3, skipped: 1 } }).codigo).toBe(2);
  });

  it("falha com vermelho real, mesmo com Playwright em 0", () => {
    expect(veredito({ ...base, vermelhos: 1, reais: 1 }).codigo).toBe(1);
  });

  it("cobertura parcial quando todo vermelho é do Storage", () => {
    expect(veredito({ ...base, statusPlaywright: 1, vermelhos: 2, reais: 0 }).codigo).toBe(2);
  });

  it("falha com erro global", () => {
    expect(veredito({ ...base, errosGlobais: [{ message: "x" }] }).codigo).toBe(1);
  });
});

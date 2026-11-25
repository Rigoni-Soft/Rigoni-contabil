/** @jest-environment node */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPTS = [".claude/scripts/checar-ambiente.mjs", ".agents/scripts/checar-ambiente.mjs"];
const TOKEN_SINTETICO = `const chave = "${"sk_live"}_${"a".repeat(24)}";\n`;

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  );

// Repositório descartável com a base já commitada; o caso adiciona um arquivo e roda o scanner contra ela.
const rodarScanner = (scriptDoRepo: string, conteudoAdicionado: string | null) => {
  const dir = mkdtempSync(join(tmpdir(), "checar-ambiente-"));
  try {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".env.example"), "");
    writeFileSync(join(dir, "src/a.ts"), "export {};\n");
    writeFileSync(join(dir, ".github/workflows/ci.yml"), "name: ci\n");
    git(dir, "init", "-q", "-b", "main");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "base");
    mkdirSync(join(dir, scriptDoRepo, ".."), { recursive: true });
    if (conteudoAdicionado === null) copyFileSync(resolve(scriptDoRepo), join(dir, scriptDoRepo));
    else writeFileSync(join(dir, scriptDoRepo), conteudoAdicionado);
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "caso");
    const r = spawnSync("node", [resolve(scriptDoRepo), "HEAD~1"], { cwd: dir, encoding: "utf8" });
    return { status: r.status, saida: r.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe.each(SCRIPTS)("checar-ambiente (%s)", (script) => {
  it("falha quando um token de provedor é adicionado ao próprio script", () => {
    const r = rodarScanner(script, TOKEN_SINTETICO);

    expect(r.status).toBe(1);
    expect(r.saida).toContain("FALHA token de provedor no diff");
  });

  it("o script verdadeiro, adicionado ao diff, não acusa a si mesmo", () => {
    const r = rodarScanner(script, null);

    expect(r.saida).toContain("OK nenhum segredo nas");
    expect(r.saida).not.toContain("FALHA token de provedor");
  });
});

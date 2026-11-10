// yarn check:design-doc [base]  →  falha se um componente novo do diff (ui/, atoms/, molecules/,
// organisms/) não aparece pelo nome no DESIGN.md. Sem `base`: DESIGN_BASE, senão origin/develop, senão develop.
// Só olha arquivos adicionados (`git diff --diff-filter=A <base>...HEAD`); o que já existia não entra.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PASTA = /^src\/presentation\/components\/(ui|atoms|molecules|organisms)\/[^/]+\.tsx$/;
const NAO_E_COMPONENTE = /\.(spec|test)\.tsx$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const existe = (ref) => {
  try {
    git("rev-parse", "--verify", "--quiet", ref);
    return true;
  } catch {
    return false;
  }
};

const pedida = process.argv[2] ?? process.env.DESIGN_BASE;
const base = [pedida, pedida && `origin/${pedida}`, "origin/develop", "develop"]
  .filter(Boolean)
  .find(existe);
if (!base) {
  console.error("base do diff não encontrada: passe `yarn check:design-doc <base>`");
  process.exit(1);
}

const paraPascal = (arquivo) =>
  arquivo
    .split("/")
    .pop()
    .replace(/\.component\.tsx$|\.tsx$/, "")
    .split("-")
    .map((parte) => parte[0].toUpperCase() + parte.slice(1))
    .join("");

const novos = git("diff", "--diff-filter=A", "--name-only", `${base}...HEAD`)
  .split(/\r?\n/)
  .filter((caminho) => PASTA.test(caminho) && !NAO_E_COMPONENTE.test(caminho));

const design = readFileSync("DESIGN.md", "utf8");
const faltando = novos.filter((caminho) => !design.includes(paraPascal(caminho)));

for (const caminho of faltando)
  console.error(
    `${caminho}: ${paraPascal(caminho)} não aparece no DESIGN.md (o que é e quando usar)`,
  );
if (faltando.length > 0) process.exit(1);
console.log(`DESIGN.md cobre os ${novos.length} componentes novos`);

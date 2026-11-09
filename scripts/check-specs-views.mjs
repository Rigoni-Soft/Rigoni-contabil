// yarn check:specs  →  falha se um Container, molecule ou organism não tem `*.spec.tsx` ao lado.
// A regra está em docs/testes.md §4.1. Os que já existiam sem spec ficam em
// scripts/specs-sem-teste.baseline.txt: a lista só encolhe (apague a linha ao criar o spec).
// `yarn check:specs --gerar-baseline` reescreve a lista com o estado atual.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASELINE = "scripts/specs-sem-teste.baseline.txt";
const ALVO = /\.(container|component)\.tsx$/;
const PASTA_DE_VIEW = /src\/presentation\/components\/(molecules|organisms)\//;

function arquivos(dir, acumulado = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).replaceAll("\\", "/");
    if (entrada.isDirectory()) arquivos(caminho, acumulado);
    else acumulado.push(caminho);
  }
  return acumulado;
}

const exigeSpec = (caminho) =>
  ALVO.test(caminho) && (caminho.endsWith(".container.tsx") || PASTA_DE_VIEW.test(caminho));

const semSpec = arquivos("src")
  .filter((caminho) => exigeSpec(caminho) && !existsSync(caminho.replace(/\.tsx$/, ".spec.tsx")))
  .sort();

if (process.argv.includes("--gerar-baseline")) {
  writeFileSync(BASELINE, `${semSpec.join("\n")}\n`);
  console.log(`baseline com ${semSpec.length} arquivos`);
  process.exit(0);
}

const aceitos = new Set(readFileSync(BASELINE, "utf8").split(/\r?\n/).filter(Boolean));
const novos = semSpec.filter((caminho) => !aceitos.has(caminho));
const resolvidos = [...aceitos].filter((caminho) => !semSpec.includes(caminho));

if (novos.length > 0 || resolvidos.length > 0) {
  for (const caminho of novos)
    console.error(`${caminho}: sem *.spec.tsx ao lado (docs/testes.md §4.1)`);
  for (const caminho of resolvidos) console.error(`${caminho}: já tem spec; tire do ${BASELINE}`);
  process.exit(1);
}
console.log("specs de Container e Views ok");

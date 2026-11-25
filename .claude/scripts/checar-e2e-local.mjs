// Roda o e2e do diff (yarn test:e2e:diff) como o gate pede, depois de conferir o ambiente em segundos.
// Verde só com o Playwright saindo em 0, sem erro global e sem teste vermelho.
// Storage local quebrado (upload dá 42P10) é falha de ambiente: o script avisa antes da rodada de ~12 min
// e, se todo vermelho nasce no cadastro de Cliente com contrato, sai com 2 (cobertura parcial), nunca com 0.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const AJUDANTE_QUE_SOBE_CONTRATO = "criar-cliente.ts";
const SAIDA_FALHA = 1;
const SAIDA_COBERTURA_PARCIAL = 2;

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local, valem as variáveis do ambiente
}
const porta = process.env.PORT ?? "8800";
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = chave
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", chave, {
      auth: { persistSession: false },
    })
  : undefined;

async function servidorNoAr() {
  try {
    const resposta = await fetch(`http://localhost:${porta}/login`, {
      signal: AbortSignal.timeout(60_000),
    });
    return resposta.ok;
  } catch {
    return false;
  }
}

async function storageQuebrado() {
  if (!supabase) return false;
  const bucket = supabase.storage.from("documentos-clientes");
  const caminho = `sonda/${Date.now()}.pdf`;
  const { error } = await bucket.upload(caminho, Buffer.from("%PDF-1.4"), {
    contentType: "application/pdf",
  });
  if (!error) await bucket.remove([caminho]);
  return Boolean(error?.message.includes("42P10"));
}

function testesVermelhos(suite, vermelhos = []) {
  for (const spec of suite.specs ?? []) {
    for (const teste of spec.tests) {
      if (teste.status !== "unexpected") continue;
      const erro = teste.results.map((r) => r.error?.stack ?? "").join("\n");
      vermelhos.push({ arquivo: spec.file, titulo: spec.title, erro });
    }
  }
  for (const filha of suite.suites ?? []) testesVermelhos(filha, vermelhos);
  return vermelhos;
}

function sair(codigo, mensagem) {
  (codigo === 0 ? console.log : console.error)(`check:e2e-local: ${mensagem}`);
  process.exit(codigo);
}

if (!(await servidorNoAr())) {
  sair(
    SAIDA_FALHA,
    `nada responde em localhost:${porta}. Suba com \`PORT=${porta} yarn dev\` (o PORT do .env.local não vale para o next dev).`,
  );
}

const quebrado = await storageQuebrado();
if (quebrado) {
  console.warn(
    "check:e2e-local: Storage local quebrado (42P10); o que ele bloquear não será verificado.",
  );
}

const pasta = mkdtempSync(join(tmpdir(), "e2e-"));
const saida = join(pasta, "playwright.json");

const execucao = spawnSync(
  "yarn",
  ["playwright", "test", "--only-changed=develop", "--reporter=list,json", ...process.argv.slice(2)],
  { stdio: "inherit", shell: true, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: saida } },
);

let relatorio;
try {
  relatorio = JSON.parse(readFileSync(saida, "utf8"));
} catch {
  relatorio = undefined;
} finally {
  rmSync(pasta, { recursive: true, force: true });
}

if (execucao.error || execucao.status === null) {
  sair(SAIDA_FALHA, "o Playwright não terminou (interrompido ou não iniciou); nada foi verificado.");
}
if (!relatorio) {
  sair(SAIDA_FALHA, "o Playwright não gerou o relatório; nada foi verificado.");
}

const errosGlobais = relatorio.errors ?? [];
const vermelhos = relatorio.suites.flatMap((s) => testesVermelhos(s));
const doStorage = (t) => quebrado && t.erro.includes(AJUDANTE_QUE_SOBE_CONTRATO);
const reais = vermelhos.filter((t) => !doStorage(t));

if (execucao.status === 0 && errosGlobais.length === 0 && vermelhos.length === 0) {
  sair(0, `e2e do diff verde (${relatorio.stats.expected} testes passaram).`);
}

for (const erro of errosGlobais) console.error(`  erro global: ${erro.message ?? erro}`);
for (const t of vermelhos) {
  const marca = doStorage(t) ? "Storage" : "vermelho";
  console.error(`  [${marca}] ${t.arquivo} › ${t.titulo}`);
}

const soStorage = errosGlobais.length === 0 && vermelhos.length > 0 && reais.length === 0;
if (soStorage) {
  sair(
    SAIDA_COBERTURA_PARCIAL,
    `cobertura parcial: ${vermelhos.length} teste(s) bloqueado(s) pelo Storage local não foram verificados (${relatorio.stats.skipped} não rodaram).`,
  );
}
sair(
  SAIDA_FALHA,
  `e2e do diff NÃO verde: Playwright saiu com ${execucao.status}, ${reais.length} vermelho(s) fora do Storage, ${errosGlobais.length} erro(s) global(is), ${relatorio.stats.skipped} não rodaram.`,
);

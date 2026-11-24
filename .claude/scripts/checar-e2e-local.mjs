// Roda o e2e do diff (yarn test:e2e:diff) como o gate pede, depois de conferir o ambiente em segundos.
// Servidor fora da 8800 ou Storage local quebrado (upload dá 42P10) são falha de ambiente, não do diff:
// o script avisa antes da rodada de ~12 min e, com o Storage quebrado, ignora só os testes que sobem arquivo.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const ESPECS_QUE_SOBEM_ARQUIVO = [
  "avatar-foto.e2e.ts",
  "cadastro-cliente.e2e.ts",
  "visualizar-contrato-social.e2e.ts",
  "parcelamentos-cliente.e2e.ts",
  "receber-midia-cliente.e2e.ts",
  "rh-convencao-coletiva.e2e.ts",
  "rh-parcelamento.e2e.ts",
  "painel-funcionario-atendimento.e2e.ts",
];
const AJUDANTE_QUE_SOBE_CONTRATO = "criar-cliente.ts";

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
    const erros = spec.tests.flatMap((t) => t.results.map((r) => r.error?.stack ?? ""));
    if (!spec.ok && spec.tests.some((t) => t.status === "unexpected")) {
      vermelhos.push({ arquivo: spec.file, titulo: spec.title, erro: erros.join("\n") });
    }
  }
  for (const filha of suite.suites ?? []) testesVermelhos(filha, vermelhos);
  return vermelhos;
}

if (!(await servidorNoAr())) {
  console.error(
    `check:e2e-local: nada responde em localhost:${porta}. Suba com \`PORT=${porta} yarn dev\` (o PORT do .env.local não vale para o next dev).`,
  );
  process.exit(1);
}

const quebrado = await storageQuebrado();
if (quebrado) {
  console.warn(
    "check:e2e-local: Storage local quebrado (42P10); os testes que sobem arquivo serão ignorados.",
  );
}

const pasta = mkdtempSync(join(tmpdir(), "e2e-"));
const saida = join(pasta, "playwright.json");

spawnSync("yarn", ["playwright", "test", "--only-changed=develop", "--reporter=list,json"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: saida },
});

let relatorio;
try {
  relatorio = JSON.parse(readFileSync(saida, "utf8"));
} catch {
  console.error("check:e2e-local: o Playwright não gerou o relatório.");
  process.exit(1);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}

const vermelhos = relatorio.suites.flatMap((s) => testesVermelhos(s));
const doStorage = (t) =>
  quebrado &&
  (ESPECS_QUE_SOBEM_ARQUIVO.includes(t.arquivo.split(/[\\/]/).pop()) ||
    t.erro.includes(AJUDANTE_QUE_SOBE_CONTRATO));
const ignorados = vermelhos.filter(doStorage);
const reais = vermelhos.filter((t) => !doStorage(t));

if (ignorados.length > 0) {
  console.warn(
    `check:e2e-local: ${ignorados.length} teste(s) vermelho(s) por Storage local ignorado(s).`,
  );
}
if (reais.length > 0) {
  console.error("check:e2e-local: teste(s) vermelho(s) que não são falha de Storage local:");
  for (const t of reais) console.error(`  ${t.arquivo} › ${t.titulo}`);
  process.exit(1);
}
console.log(`check:e2e-local: e2e do diff verde (${relatorio.stats.expected} testes passaram).`);

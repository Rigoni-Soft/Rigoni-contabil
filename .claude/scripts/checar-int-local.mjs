// Roda a integração como o CI (yarn test:int) antes do push.
// Storage local quebrado (upload dá 42P10) derruba as suítes de SUITES_DE_STORAGE: falha de ambiente, não do diff.
// Com o Storage sano, toda suíte vermelha bloqueia; com ele quebrado, só as que não estão na lista.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const SUITES_DE_STORAGE = [
  "avatar-storage-politica.gateway.test.ts",
  "cliente-parcelamento.repository.test.ts",
  "convencao.repository.test.ts",
  "anexos-atendimento-storage-politica.gateway.test.ts",
  "supabase-lembretes.gateway.test.ts",
  "supabase-arquivo-storage.gateway.test.ts",
  "supabase-avatar.gateway.test.ts",
  "supabase-guias-pgfn.gateway.test.ts",
  "supabase-anexos-atendimento.gateway.test.ts",
  "documentos-contratuais-cliente.gateway.test.ts",
  "supabase-documentos-contratuais.gateway.test.ts",
];

// O Jest e este script leem o mesmo .env.local (o que já estiver no ambiente tem prioridade).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local, valem as variáveis do ambiente
}
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = chave
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", chave, {
      auth: { persistSession: false },
    })
  : undefined;

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

// O banco local acumula Clientes de e2e e de rodadas anteriores; a carteira do RH aborta acima de 100 páginas.
async function clientesAcumulados() {
  if (!supabase) return 0;
  const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true });
  return count ?? 0;
}

const quebrado = await storageQuebrado();
const acumulados = await clientesAcumulados();
const pasta = mkdtempSync(join(tmpdir(), "int-"));
const saida = join(pasta, "jest.json");

spawnSync(
  "yarn",
  ["jest", "--selectProjects", "integration", "--runInBand", "--json", `--outputFile=${saida}`],
  { stdio: "ignore", shell: true },
);

let resultado;
try {
  resultado = JSON.parse(readFileSync(saida, "utf8"));
} catch {
  console.error("check:int-local: o Jest não gerou o relatório (o Supabase local está no ar?).");
  process.exit(1);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}

const nome = (s) => s.name.replace(/\\/g, "/").split("/").pop();
const vermelhas = resultado.testResults.filter((s) => s.status === "failed");
const doStorage = (s) => quebrado && SUITES_DE_STORAGE.includes(nome(s));
const ignoradas = vermelhas.filter(doStorage);
const reais = vermelhas.filter((s) => !doStorage(s));

if (acumulados > 90) {
  console.warn(
    `check:int-local: ${acumulados} Clientes no banco local (o CI começa com 9). Suíte vermelha que pagina a carteira pede \`npx supabase db reset\`.`,
  );
}
if (ignoradas.length > 0) {
  console.warn(
    `check:int-local: Storage local quebrado (42P10); ${ignoradas.length} suíte(s) de Storage ignorada(s).`,
  );
}
if (reais.length > 0) {
  console.error("check:int-local: suíte(s) vermelha(s) que não são falha de Storage local:");
  for (const s of reais) console.error(`  ${s.name.replace(process.cwd(), "")}`);
  process.exit(1);
}
console.log(`check:int-local: integração verde (${resultado.numPassedTestSuites} suítes passaram).`);

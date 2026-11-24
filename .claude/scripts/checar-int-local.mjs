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

function variavel(nome) {
  if (process.env[nome]) return process.env[nome];
  try {
    const linha = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${nome}=`));
    return linha?.slice(nome.length + 1).trim();
  } catch {
    return undefined;
  }
}

async function storageQuebrado() {
  const url = variavel("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const chave = variavel("SUPABASE_SERVICE_ROLE_KEY");
  if (!chave) return false;
  const bucket = createClient(url, chave, { auth: { persistSession: false } }).storage.from(
    "documentos-clientes",
  );
  const caminho = `sonda/${Date.now()}.pdf`;
  const { error } = await bucket.upload(caminho, Buffer.from("%PDF-1.4"), {
    contentType: "application/pdf",
  });
  if (!error) await bucket.remove([caminho]);
  return Boolean(error?.message.includes("42P10"));
}

// O banco local acumula Clientes de e2e e de rodadas anteriores; a carteira do RH aborta acima de 100 páginas.
async function clientesAcumulados() {
  const url = variavel("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const chave = variavel("SUPABASE_SERVICE_ROLE_KEY");
  if (!chave) return 0;
  const { count } = await createClient(url, chave, { auth: { persistSession: false } })
    .from("clientes")
    .select("id", { count: "exact", head: true });
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

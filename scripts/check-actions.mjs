import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = "src";

const SO_ENCERRA_A_SESSAO = "src/presentation/view-models/shell/logout.actions.ts";
const NAO_RECEBE_DADO_DO_CLIENTE =
  "src/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.actions.ts";

export const SEM_ENTRADA = new Set([SO_ENCERRA_A_SESSAO, NAO_RECEBE_DADO_DO_CLIENTE]);

const ACTIONS = /\.actions\.ts$/;
const VALIDA = /from "zod"|\.schema"/;

function percorrer(dir, acumulado = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).replaceAll("\\", "/");
    if (entrada.isDirectory()) percorrer(caminho, acumulado);
    else if (ACTIONS.test(entrada.name)) acumulado.push(caminho);
  }
  return acumulado;
}

export function actionsSemZod(raiz = ROOT, isentas = SEM_ENTRADA) {
  return percorrer(raiz).filter(
    (caminho) => !isentas.has(caminho) && !VALIDA.test(readFileSync(caminho, "utf8")),
  );
}

if (process.argv[1]?.endsWith("check-actions.mjs")) {
  const sem = actionsSemZod();
  for (const caminho of sem) {
    console.error(`${caminho}: Server Action sem schema Zod (docs/arquitetura.md, 3.13 passo 1)`);
  }
  if (sem.length > 0) process.exit(1);
  console.log("actions ok");
}

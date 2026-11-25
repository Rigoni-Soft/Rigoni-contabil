import { readdirSync } from "node:fs";
import { join } from "node:path";

export const ROOT = "src/app";
export const PERMITIDAS = ["api/webhooks/", "api/jobs/", "api/avatar/"];

const ROTA = /^route\.tsx?$/;

function percorrer(dir, acumulado = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).replaceAll("\\", "/");
    if (entrada.isDirectory()) percorrer(caminho, acumulado);
    else if (ROTA.test(entrada.name)) acumulado.push(caminho);
  }
  return acumulado;
}

export function rotasFora(raiz = ROOT) {
  return percorrer(raiz).filter((caminho) => {
    const relativo = caminho.slice(raiz.length + 1);
    return !PERMITIDAS.some((prefixo) => relativo.startsWith(prefixo));
  });
}

if (process.argv[1]?.endsWith("check-rotas.mjs")) {
  const fora = rotasFora();
  for (const caminho of fora) {
    console.error(
      `${caminho}: route.ts só em ${PERMITIDAS.join(", ")} (docs/arquitetura.md, premissa 1 e seção 3.13)`,
    );
  }
  if (fora.length > 0) process.exit(1);
  console.log("rotas ok");
}

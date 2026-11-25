import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const APP_DIR = "src/app";

export const PAGINAS_PUBLICAS = new Set(["login/page.tsx", "privacidade/page.tsx"]);

const CHAMA_GUARDA_DE_SESSAO = /(exigirSessao|validarSessao)[(]/;

export const ISENTAS_DO_REDIRECT = new Set(["trocar-senha/page.tsx"]);

export function paginas(dir, prefixo = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) return paginas(join(dir, entrada.name), relativo);
    return entrada.name === "page.tsx" ? [relativo] : [];
  });
}

export function classificarPagina(pagina, conteudo) {
  if (PAGINAS_PUBLICAS.has(pagina)) return null;
  if (CHAMA_GUARDA_DE_SESSAO.test(conteudo)) return null;

  if (!conteudo.includes("carregarSessao")) {
    return `${pagina}: não carrega a sessão (carregarSessao) — se for pública de propósito, adicione a PAGINAS_PUBLICAS`;
  }
  if (!ISENTAS_DO_REDIRECT.has(pagina) && !conteudo.includes("precisaTrocarSenha")) {
    return `${pagina}: carrega a sessão mas não checa precisaTrocarSenha`;
  }
  return null;
}

function main() {
  const erros = paginas(APP_DIR)
    .map((pagina) => classificarPagina(pagina, readFileSync(join(APP_DIR, pagina), "utf8")))
    .filter((erro) => erro !== null)
    .map((erro) => `${APP_DIR}/${erro}`);

  erros.forEach((e) => console.error(e));
  if (erros.length) process.exit(1);
  console.log("guard de troca de senha ok");
}

const executadoComoScript = process.argv[1]?.endsWith("check-troca-senha-guard.mjs");
if (executadoComoScript) {
  main();
}

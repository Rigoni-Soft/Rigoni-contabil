// yarn check:guard-senha  →  falha se alguma página autenticada sob src/app
// esquecer o bloqueio de troca obrigatória de senha (precisaTrocarSenha).
//
// Devolutiva técnica PR #62, ponto 7 (risco regressivo, não bloqueador): hoje
// cada page.tsx repete `if (sessao.precisaTrocarSenha) redirect("/trocar-senha")`
// em vez de centralizar num layout/guard comum. Decisão aceita por ora (poucas
// rotas autenticadas ainda) — este script é a rede de segurança mais barata
// pra isso não virar um bypass silencioso numa rota nova.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const APP_DIR = "src/app";

// Páginas públicas de verdade: não exigem sessão pra existir, então ficam de
// fora de qualquer checagem (nem carregarSessao, nem precisaTrocarSenha).
// Devolutiva técnica complementar PR #62, ajuste 2: antes este script só
// pegava quem chamava carregarSessao e esquecia precisaTrocarSenha — uma
// página nova que esquecesse de chamar carregarSessao passava batido. Agora
// toda página fora desta lista é obrigada a chamar carregarSessao; só entra
// aqui quem é public de propósito (login é o único caso hoje).
export const PAGINAS_PUBLICAS = new Set(["login/page.tsx"]);

// /trocar-senha é o próprio destino do redirect: carrega sessão (pra saber o
// estado), mas não pode checar precisaTrocarSenha contra si mesma.
export const ISENTAS_DO_REDIRECT = new Set(["trocar-senha/page.tsx"]);

export function paginas(dir, prefixo = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) return paginas(join(dir, entrada.name), relativo);
    return entrada.name === "page.tsx" ? [relativo] : [];
  });
}

// Pura (sem tocar em disco) pra poder ser testada por unidade sem precisar
// montar uma árvore de arquivos de verdade.
export function classificarPagina(pagina, conteudo) {
  if (PAGINAS_PUBLICAS.has(pagina)) return null;

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

// Só roda a varredura real quando chamado como script (yarn check:guard-senha);
// o teste de unidade importa classificarPagina sem disparar isso.
if (process.argv[1] && process.argv[1].endsWith("check-troca-senha-guard.mjs")) {
  main();
}

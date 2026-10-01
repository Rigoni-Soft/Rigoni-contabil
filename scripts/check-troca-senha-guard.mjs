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

const APP_DIR = "src/app";
// /login redireciona pra cá; /trocar-senha é o próprio destino do redirect —
// as duas têm motivo pra não checar precisaTrocarSenha.
const ALLOWLIST = new Set(["login/page.tsx", "trocar-senha/page.tsx"]);

function paginas(dir, prefixo = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) return paginas(join(dir, entrada.name), relativo);
    return entrada.name === "page.tsx" ? [relativo] : [];
  });
}

const erros = paginas(APP_DIR)
  .filter((pagina) => !ALLOWLIST.has(pagina))
  .filter((pagina) => {
    const conteudo = readFileSync(join(APP_DIR, pagina), "utf8");
    return conteudo.includes("carregarSessao") && !conteudo.includes("precisaTrocarSenha");
  });

erros.forEach((e) =>
  console.error(`${APP_DIR}/${e}: carrega a sessão mas não checa precisaTrocarSenha`),
);
if (erros.length) process.exit(1);
console.log("guard de troca de senha ok");

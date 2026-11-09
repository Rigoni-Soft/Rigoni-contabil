// yarn check:refs  →  falha se um comentário de código citar ticket (#NN); só vale `TODO(#NN)`.
// A regra está em docs/arquitetura.md §2 ("Referências a ticket"). Títulos de describe/it e strings não entram.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZES =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ["src", "e2e", "test-support", "supabase/migrations"];
const CODIGO = /\.(ts|tsx|mjs|sql)$/;
// SQL comenta com `--`.
const COMENTARIO_SQL = /^\s*--.*#\d+\b|\s--\s.*#\d+\b/;
// Linha de comentário, comentário no fim da linha, bloco na linha. O `\b` deixa passar cor hex (#1a2b3c).
const COMENTARIO_COM_TICKET = /^\s*(\/\/|\/\*|\*|\{\/\*).*#\d+\b|\s\/\/\s.*#\d+\b|\/\*[^*].*#\d+\b/;

const erros = [];

function percorrer(dir) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).replaceAll("\\", "/");
    if (entrada.isDirectory()) {
      if (entrada.name !== "node_modules") percorrer(caminho);
    } else if (CODIGO.test(entrada.name)) {
      leia(caminho);
    }
  }
}

function leia(caminho) {
  readFileSync(caminho, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      const regra = caminho.endsWith(".sql") ? COMENTARIO_SQL : COMENTARIO_COM_TICKET;
      if (regra.test(linha) && !/TODO\(#\d+\)/.test(linha)) {
        erros.push(
          `${caminho}:${i + 1}: comentário com referência a ticket (use TODO(#NN) ou tire o #NN)`,
        );
      }
    });
}

for (const raiz of RAIZES) percorrer(raiz);

if (erros.length > 0) {
  console.error(erros.join("\n"));
  process.exit(1);
}
console.log("referências a ticket ok");

// Hook PreToolUse (Bash): `node -e` com barra invertida (regex como `\d` ou `\p{M}`, `\n`) entrega o código ao
// Node sem a barra e grava o arquivo quebrado, sem erro algum (.claude/CLAUDE.md, "Edição de arquivos").
// Recusa o comando e manda criar o script com `Write` e rodá-lo como arquivo.
let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  let comando = "";
  try {
    comando = JSON.parse(entrada).tool_input?.command ?? "";
  } catch {
    return;
  }
  // Código inline de verdade: a flag seguida de aspas (o texto "node -e" numa mensagem não conta).
  const inline = /(?:^|[\s;&|(])node\s+(?:-\w+\s+)*(?:-e|-p|--eval|--print)\s+["']/;
  if (!inline.test(comando) || !comando.includes("\\")) return;
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "`node -e` com barra invertida perde a barra e grava código quebrado sem erro: crie o script com a ferramenta Write e rode `node <arquivo>`.",
      },
    }),
  );
});

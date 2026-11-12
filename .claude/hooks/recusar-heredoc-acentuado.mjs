// Hook PreToolUse (Bash): heredoc (`<<`) com texto acentuado quebra o Bash deste ambiente (o arquivo some ou sai
// truncado). Recusa o comando e manda criar o arquivo com `Write`.
let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  let comando = "";
  try {
    comando = JSON.parse(entrada).tool_input?.command ?? "";
  } catch {
    return;
  }
  if (!/<<-?\s*['"]?\w+/.test(comando) || !/[À-ÿ]/.test(comando)) return;
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Heredoc com texto em português quebra o Bash aqui: crie o arquivo com a ferramenta Write.",
      },
    }),
  );
});

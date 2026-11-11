# Formatação
- O CI roda `yarn format:check`. Antes da PR, formate os arquivos do diff (`git diff <base>...HEAD --name-only | xargs npx prettier --write`) num commit `style:` à parte; `prettier --write` num arquivo que o diff não tocou reflowa linhas alheias.

# E2E
- O Playwright reaproveita o dev server em `localhost:8800`. Com `PORT=8800` no `.env.local` o `yarn dev` aberto serve o e2e; em outra porta o Playwright tenta subir um segundo `next dev` no mesmo diretório e falha.

# Edição de arquivos
- Os arquivos já versionados estão em CRLF: edite com `Edit` ou preserve o fim de linha ao trocar texto por script (trocar texto por script com quebra de linha LF não casa e falha em silêncio).
- Crie arquivo com `Write`: heredoc (`<<'EOF'`) com texto em português quebra o `Bash`.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

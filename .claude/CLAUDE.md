# Formatação
- O CI roda `yarn format:check`. Antes da PR, formate os arquivos do diff (`git diff <base>...HEAD --name-only | xargs npx prettier --write`) num commit `style:` à parte; `prettier --write` num arquivo que o diff não tocou reflowa linhas alheias.

# E2E
- O Playwright reaproveita o dev server em `localhost:8800`. Com `PORT=8800` no `.env.local` o `yarn dev` aberto serve o e2e; em outra porta o Playwright tenta subir um segundo `next dev` no mesmo diretório e falha.

# Edição de arquivos
- O working tree está em LF na maior parte, mas alguns arquivos ficam em CRLF (`git ls-files --eol`, coluna `w/crlf`): edite com `Edit` ou `Write`; script de `replace` (node, sed) em arquivo CRLF não casa e falha em silêncio, então normalize `\r\n` para `\n` antes. O aviso "LF will be replaced by CRLF" do Git é esperado.
- Crie arquivo com `Write`: heredoc (`<<'EOF'`) com texto em português quebra o `Bash`.
- Trecho com `\` (regex, `\n`) entra por `Edit` ou `Write`: `node -e` inline engole a barra invertida e grava o código quebrado. Não há `python` na máquina.

# Testes
- Uma suíte só: `yarn test --testPathPatterns <padrão>`. O padrão posicional (`yarn test <padrão>`) é ignorado e roda as 327 suítes (~40 s).
- Nunca rode `npx jest` puro: ele sobe os projetos unit e integration juntos e as suítes de integração (`*.test.ts`) disputam o mesmo banco local, o que gera falha que some ao rodar isolada. Use `yarn test` (unit) e `yarn test:int` (integração, em série); `yarn test:all` roda os dois.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

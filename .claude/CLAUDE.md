# Formatação
- Edite à mão e confira com `yarn lint`: o repo não passa `prettier --check` (o CI não o roda), e `prettier --write` num arquivo existente reflowa linhas alheias ao diff.

# E2E
- O Playwright reaproveita o dev server em `localhost:8800`. Com `PORT=8800` no `.env.local` o `yarn dev` aberto serve o e2e; em outra porta o Playwright tenta subir um segundo `next dev` no mesmo diretório e falha.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

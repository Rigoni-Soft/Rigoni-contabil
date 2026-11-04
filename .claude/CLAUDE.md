# Formatação
- Edite à mão e confira com `yarn lint`: o repo não passa `prettier --check` (o CI não o roda), e `prettier --write` num arquivo existente reflowa linhas alheias ao diff.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

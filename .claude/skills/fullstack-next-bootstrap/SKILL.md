---
name: fullstack-next-bootstrap
description: Roda a sequência completa de bootstrap de um projeto fullstack Next.js deste time — cria o projeto, monta a estrutura de pastas, configura ESLint/Prettier/regras de camada, testes (Jest/RTL/Supertest/Playwright), env.ts e o Graphify. Use apenas para o bootstrap completo de um projeto novo do zero. Para uma parte isolada (só lint, só testes, só env.ts, só Graphify) invoque a skill específica em vez desta.
---

# Bootstrap completo (orquestradora)

Esta skill não repete conteúdo: ela invoca, nesta ordem, cada skill de responsabilidade única. Cada uma tem sua própria fonte de regras (`docs/arquitetura.md` ou `docs/testes.md`) e seus próprios avisos — leia o `SKILL.md` de cada uma ao invocá-la.

**O projeto é sempre `.`**.

## Ordem

1. **`next-project-init`** — cria o projeto Next.js e a estrutura de pastas. Sempre primeiro; as demais pressupõem que o projeto já existe.
2. **`eslint-prettier-clean-arch`** — ESLint, Prettier, regras de camada, nomenclatura.
3. **`test-setup-jest-playwright`** — Jest, RTL, Supertest, Playwright.
4. **`generate-env-ts`** — sempre roda. Se não houver `.env.example` na raiz depois do passo 1, a própria skill cria um mínimo (`PORT=8800`) antes de gerar `env.ts`.
5. **`graphify-integration`** — só se o usuário quiser o Graphify (pergunte, se não tiver sido pedido explicitamente; é uma ferramenta de terceiros, com passo de instalação fora do projeto).

## Fechamento

Depois das skills acima, rode:

```bash
yarn format
yarn lint
yarn check:deps
yarn check:naming
yarn test
```

## Rastreabilidade

| Parte | Skill | Origem |
|---|---|---|
| Criação do projeto, estrutura de pastas, DTOs base | `next-project-init` | `arquitetura.md`, seções 1, 3.2, 3.8 |
| ESLint, Prettier, dependency-cruiser, nomenclatura | `eslint-prettier-clean-arch` | Anexos A, B, E de `arquitetura.md` |
| Jest, RTL, Supertest, Playwright, cobertura | `test-setup-jest-playwright` | `testes.md`, seções 6 e 7 |
| `env.ts` / `env.client.ts` | `generate-env-ts` | Decisão desta skill (não vem literalmente do documento) |
| Graphify | `graphify-integration` | README de github.com/Graphify-Labs/graphify, lido direto (`gh api`) e confirmado |

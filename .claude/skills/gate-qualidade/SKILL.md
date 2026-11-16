---
name: gate-qualidade
description: Estação 4 da esteira de desenvolvimento — pipeline de qualidade em laço sequencial sobre o diff da branch (impeccable audit até 20/20, ponytail-review, code-review-spec, retro), cada etapa só avança com zero apontamentos novos e nunca repete um já resolvido (ledger em arquivo). Uso — /gate-qualidade [base].
argument-hint: [base]
---

Argumento: `$ARGUMENTS` = base do diff. Sem base: `gh pr view --json baseRefName` se a branch tem PR; senão `develop`. Em branch empilhada, passe a branch do ticket anterior. O escopo é sempre `git diff <base>...HEAD`.

## Preparação

1. `git status --porcelain` sem alteração de arquivo rastreado (senão pare: o gate revisa o que está commitado). `M` com `git diff` vazio é só fim de linha (CRLF x LF): `git add <arquivo>` normaliza e o status limpa.
2. Ledger: `.claude/state/<branch com / trocado por ->/ledger.md` (ignorado pelo git). Crie com o cabeçalho `ID | etapa | resumo | status | commit` se não existir. **Todo apontamento tratado entra aqui** (`resolvido` ou `recusado`); nada que conste no ledger volta a ser apontado.
3. Argumento igual à branch atual: o diff `base...HEAD` fica vazio; pare e pergunte a base.
4. Liste os arquivos do diff. Há UI (`*.tsx`, `*.css`, `DESIGN.md`)? Isso decide a etapa 1.

## Como cada etapa roda (laço)

1. **Auditar**: chame o subagent `auditor-de-qualidade` (Agent tool) com: etapa, base e caminho do ledger. Ele só lê e devolve uma tabela curta de apontamentos novos. A etapa 3 não usa o subagent (ver abaixo).
2. **Tratar**: mecânico e inequívoco → corrija. Exige decisão (arquitetura, apagar código que pode ser de ticket planejado, custo, escopo) → **pergunte ao usuário** antes.
3. **Registrar** no ledger e **rodar de novo** a mesma etapa. Só avança com zero apontamentos novos.
4. **Teto: 5 rodadas por etapa** (esperar resposta do usuário não conta). Estourou → pare e reporte o que falta e por quê (apontamento que reaparece indica causa raiz não tratada).
5. Etapa que mudou arquivo → **um commit** (Conventional Commits). Antes de commitar confira `git diff --cached --name-only`: só entram arquivos que o gate tocou, nunca `git add -A`.

## Etapas (nesta ordem, sem pular)

**1. `impeccable audit`** — só se há UI no diff (senão registre "design não aplicável"). Saída: **20/20 e zero ações recomendadas**. O audit só lê o código: a dimensão Responsivo fica em 3/4 sem verificação visual, então **19/20 cuja única perda é essa, sem apontamento aberto, fecha a etapa**; o registro no ledger diz que o 320 px e o alvo de toque ficam para o `/roteiro-teste-local`. Nota `n/a` não fecha a etapa: chame o auditor de novo mandando executar a skill `impeccable audit`; se ela não rodar, reporte "nota não obtida" ao usuário em vez de dar a etapa por fechada. Quando o audit recomendar outras skills do impeccable (polish, distill, harden, etc.), **siga a recomendação**: invoque-as, depois audite de novo. **Regressão, P0, P1 e P2 bloqueiam; P3 de preferência** (gosto, sem regressão nem barreira de uso) entra no ledger como `recusado` com o motivo e não abre rodada nova. O auditor marca cada achado como `regressão` ou `preferência`. Na **rodada 1**, mande o auditor varrer **todo organismo/molécula tocado pelo diff** (não só as linhas novas) contra estados, ícone+texto, tamanho legível e vínculo de erro ao campo, para não descobrir um achado por rodada. Se o diff mexe em cor (`globals.css`, token novo, classe de tom/fundo de linha, botão de variante nova) ou traz link ou texto apagado (`text-muted-foreground`) novo, mande o auditor **medir o contraste** nos dois temas já na rodada 1: texto 4,5:1, borda de campo e ícone 3:1, inclusive **sobre o fundo tingido** onde o elemento fica (4,5:1); ele só lê o código e, sem a medição, a nota esconde um P2 possível.

**2. `ponytail-review`** — código morto, abstração desnecessária, dependência redundante. Saída: zero apontamentos. `delete` de algo ainda não usado mas possivelmente de ticket planejado: pergunte.

**3. `code-review-spec`** — roda direto aqui (ele já dispara os revisores Standards e Spec em paralelo; os padrões são `docs/arquitetura.md` e `docs/testes.md`). Descarte do relatório o que já está no ledger. No eixo Spec, confira cada campo que a tela pede: só entra campo para o que a issue manda o usuário informar; o que a issue diz que o sistema extrai ou deriva (de um PDF, de outro cadastro) nunca é campo (o formulário da convenção da #219 pedia sindicato e vigência e passou por toda a revisão). Corrija, registre e rode de novo. Saída: zero apontamentos novos.

**4. `retro`** — retrospectiva do processo e dos guardrails (lint, checks, docs, skills). Apresente os candidatos; aplique os que o usuário aprovar, registre e rode de novo. Saída: nenhuma pendência estrutural nova.

**5. Checks do CI** — `yarn tsc --noEmit`, `yarn check:naming`, `yarn check:refs`, `yarn check:specs`, `yarn check:design-doc <base>`, `yarn check:deps` e `yarn check:guard-senha` e `npx prettier --check` nos arquivos do diff (o `ci.yml` roda `yarn format:check`). Falhou: corrija, registre no ledger e rode de novo; commit só se mudou arquivo.

**E2E do diff (só com UI no diff):** com o dev server em `http://localhost:8800` e o Supabase local no ar (`curl -s -o /dev/null -w "%{http_code}" http://localhost:<porta>/login`; a porta do `yarn dev` aberto, 8800 com `PORT=8800` no `.env.local`), rode `PORT=<porta do dev server em uso> npx playwright test --only-changed=<base>` (só os `*.e2e.ts` ligados ao diff; com `PORT` igual ao do servidor aberto o Playwright o reaproveita em vez de tentar subir outro; ex.: `PORT=3000`). Falhou: corrija, registre e rode de novo. Servidor fora do ar: registre "e2e não rodado: servidor fora do ar" no ledger e reporte ao usuário; não suba o dev server sem ordem dele.

## Fim

Reporte: nota final do audit, rodadas por etapa, commits gerados (hash e mensagem), decisões que o usuário tomou, o que parou no teto. **Nunca `git stash`** (nem `-u`: há arquivos soltos do usuário no repositório, como `supabase/snippets/`; para comparar com a base, use `git show` ou `git worktree`). **Nunca `git push`** sem ordem explícita (um hook também pede confirmação). Próximo passo: se o grupo tem UI, `/roteiro-teste-local` (teste manual, antes de subir a PR); depois é do usuário: push e PR.

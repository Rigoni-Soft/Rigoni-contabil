---
name: implementar-issue
description: Cria a branch da issue (empilhada sobre outra issue/branch, ou sobre a develop) e indica o /mattpocock-skills:implement a rodar. Uso — /implementar-issue <issue> [base], onde base é um número de issue ou o nome de uma branch; sem base, parte da develop.
argument-hint: <issue> [issue-ou-branch-base]
disable-model-invocation: true
---

Argumentos: `$ARGUMENTS` → primeiro token = issue alvo (`#123` ou `123`); segundo token (opcional) = base (número de issue ou nome de branch). Sem issue alvo, pergunte e pare.

## 1. Resolver a base

- Sem base → `develop`.
- Base é nome de branch existente (`git rev-parse --verify <base>`) → essa branch.
- Base é número de issue → a branch dessa issue: procure `git branch --list "*<n>*"` e `gh pr list --search "<n>" --state all --json headRefName,number`; se houver mais de uma candidata ou nenhuma, pergunte. Nunca chute.

## 2. Preparar a branch

1. `git status --porcelain`: se houver alteração em arquivo **rastreado**, pare e avise (untracked como `supabase/snippets/` pode ficar).
2. Sem base explícita, `git fetch origin develop` e parta de `origin/develop` se a `develop` local estiver atrás (`git merge --ff-only`); nunca force nada.
3. `gh issue view <issue> --json title,labels` e monte o nome `feature/<slug-do-título>` (kebab-case, sem acento, ≤ 6 palavras; `fix/` se a issue for bug). Se a branch já existir, pare e pergunte.
4. `git switch -c <nome> <base>`.

## 3. Reportar

Em poucas linhas: branch criada, base usada e o comando para o usuário rodar em seguida: `/mattpocock-skills:implement <issue>` (a skill é bloqueada para o Claude; não tente invocá-la). Nunca `git push` nem abrir PR sem ordem explícita.

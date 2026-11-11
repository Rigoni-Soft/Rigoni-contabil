---
name: implementar-issue
description: Estação 3 da esteira de desenvolvimento — cria a branch do ticket (empilhada sobre outro ticket/branch, ou sobre a develop), implementa com TDD e deixa commitado, sem push. Uso — /implementar-issue <issue> [base], onde base é um nº de issue ou nome de branch; sem base, parte da develop.
argument-hint: <issue> [issue-ou-branch-base]
disable-model-invocation: true
---

Argumentos: `$ARGUMENTS` → 1º token = issue alvo (`#123` ou `123`); 2º (opcional) = base (nº de issue ou nome de branch). Sem issue, pergunte e pare.

## 1. Resolver a base

- Sem base → `develop`.
- Base é nome de branch existente (`git rev-parse --verify <base>`) → essa branch.
- Base é nº de issue → a branch dela: `git branch --list "*<n>*"` e `gh pr list --search "<n>" --state all --json headRefName,number`; se houver mais de uma candidata ou nenhuma, pergunte. Nunca chute.

## 2. Preparar a branch

1. `git status --porcelain`: alteração em arquivo **rastreado** → pare e avise (untracked como `supabase/snippets/` pode ficar). `M` com `git diff` vazio é só fim de linha (CRLF x LF): `git add <arquivo>` normaliza e o status limpa.
2. Sem base explícita, `git fetch origin develop` e parta de `origin/develop` se a local estiver atrás (`git merge --ff-only`); nunca force.
3. `gh issue view <issue> --json title,labels` e monte `feature/<slug-do-título>` (kebab-case, sem acento, ≤ 6 palavras; `fix/` se for bug). Branch já existe → pare e pergunte.
   Antes disso, procure trabalho já feito na issue: `git log --all --oneline --grep "#<n>"` e a linha dela em `docs/trilha-implementacao.md`. Achou commits ou a trilha marcada como feita → pare, mostre a branch e sugira `/gate-qualidade` em vez de reimplementar.
4. `git switch -c <nome> <base>`.

## 3. Implementar

Antes de codar, confira cada critério de aceite da issue: a fonte que ele cita (planilha, PDF, tabela) existe em `docs/` ou no repositório, e todo percentual ou valor dele passa nos validadores do kernel (`src/shared/kernel`). Fonte ausente ou valor recusado por regra escrita → pergunte ao usuário antes de implementar; quem decide é a convenção ou a legislação, não o agente.

Chame a Skill `implement` com a issue (ela lê o ticket, usa `tdd` nos pontos acordados, roda typecheck e testes e comita). Se build, teste ou runtime falharem e a causa não for óbvia, chame `diagnosing-bugs` antes de insistir.

Commits em Conventional Commits, atômicos, na branch do ticket. Adicione só os arquivos que a estação tocou (`git add <caminhos>`): `git add -A` leva junto a alteração solta do usuário em arquivo rastreado.

Tela de formulário nova parte de `editar-cadastro-operacional.page.tsx` e `cartao-do-cadastro.component.tsx`: largura `cadastro`, cartão com `MOLDURA_DO_CARTAO`, `CampoDeTexto` na malha `1>2>4` e `NotaDeObrigatorio`.

Tela que lista itens e os cadastra/edita na própria tela segue a seção "Tela de lista + formulário" do `DESIGN.md` (nota de obrigatório no topo, lista com divisores, ação principal cheia e editar em ícone de contorno, editar substitui o formulário novo, rodapé Salvar / ação de atenção em vermelho / Cancelar, conteúdo de outra natureza em tela própria), sem esperar o pedido.

Antes de criar um componente de UI, liste `src/presentation/components/{ui,atoms,molecules,organisms}` e leia no `DESIGN.md` a seção da tela; o componente novo só nasce quando nenhum existente serve, e entra no `DESIGN.md` no mesmo commit (`yarn check:design-doc <base>` reprova o que faltar).

Quando o usuário corrigir o **desenho** depois da implementação, atualize na mesma rodada `CONTEXT.md`, `docs/trilha-implementacao.md` e os e2e que citam a tela antiga, antes de reportar; o gate e o roteiro de teste leem esses arquivos.

## 4. Fechar a estação

Rode `yarn tsc --noEmit`, `yarn lint`, `yarn test`, `yarn check:naming`, `yarn check:refs`, `yarn check:deps` e `npx prettier --check` nos arquivos do diff (arquivo novo sem sufixo de papel, `#NN` em comentário e import entre camadas proibido, como presenter importando `domain`, reprovam no CI). **Critério de saída: código implementado e commitado na branch, com type-safety, testes e checks verdes.**

Reporte: branch, base, commits e o próximo passo: `/gate-qualidade [base]`. **Nunca `git push`, nem abrir PR, sem ordem explícita do usuário** (um hook também pede confirmação). **Nunca `git stash`** (nem `-u`: há arquivos soltos do usuário no repositório, como `supabase/snippets/`); para comparar um teste com a base, use `git show` ou `git worktree`.

Pedido do usuário que mexa em **permissão** (quem lê, marca, edita ou atribui) é conferido antes de codar com os AC da issue e o `CONTEXT.md`; se contradisser algum, pergunte qual vale em vez de implementar (o gate só pega o conflito depois do código).

Ao **refatorar uma peça de UI** que o usuário já ajustou (espaço, ordem, destaque, cor), releia os pedidos de UI dele antes de reportar: o jest não pega CSS, e uma refatoração já perdeu o espaço abaixo do mês de referência.

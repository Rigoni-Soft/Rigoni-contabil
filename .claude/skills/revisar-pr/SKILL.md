---
name: revisar-pr
description: Trata a devolutiva técnica (PDF) de uma PR — extrai os apontamentos, confere cada um contra o código e os 3 critérios do projeto, corrige os que não precisam de decisão humana, pede permissão para o push e, confirmado, publica (force-with-lease se preciso), comenta na PR e gera o PDF de resposta no modelo da devolutiva. Uso — /revisar-pr <caminho-do-PDF> [pr]
argument-hint: <pdf> [pr]
disable-model-invocation: true
---

Argumentos: `$ARGUMENTS` → 1º token = caminho do PDF da devolutiva; 2º (opcional) = número da PR (senão, o do título/cabeçalho do PDF, confirmado com `gh pr view`). Sem PDF, pergunte e pare.

## 1. Ler a devolutiva

1. Extraia o texto: `python -I -c "import pymupdf; [print(p.get_text()) for p in pymupdf.open(r'<pdf>')]"` (o `Read` de PDF falha aqui, sem poppler; se `pymupdf` faltar, `pypdf`). Para ver o layout, renderize uma página para PNG e abra com `Read`.
2. Liste os apontamentos (IDs como `200-F1`, `G`, `O`), o **SHA revisado**, a base/dependências e o que o revisor diz **não ter verificado**.
3. `gh pr view <n> --json headRefOid,state,baseRefName,statusCheckRollup`. Se o head atual ≠ SHA revisado, saiba por quê (rebase? commits novos?) antes de seguir.

## 2. Triar cada apontamento (individualmente, sem aplicar nada ainda)

Confira a alegação no código **do SHA revisado** (`git show <sha>:<arquivo>`), não pelo relatório: pode estar certa, errada ou parcial. Depois, contra os 3 critérios:

1. Conflita com regra documentada (`docs/arquitetura.md`, `testes.md`, Anexos)? Violação **documentada** é obrigatória; só smell sem regra escrita é julgamento.
2. Conflita com decisão já tomada (ADRs em `docs/adr/`, `CONTEXT.md`, memória, comentários da PR/issue)?
3. Faz sentido no estágio atual? Se não, a saída mais barata e rastreável é adiamento formal (issue/comentário), não construir sem objeto.

"Fora do diff" **não** descarta achado real. Cada achado entra em uma de três classes:

- **Resolver** — passa nos critérios e a correção é inequívoca.
- **Decisão humana** — conflito com regra/decisão, escolha de produto, custo/plano, aceite operacional (ex.: cadência do cron), ou ambiente que só o usuário conhece (migration já aplicada onde?).
- **Informativo** — verde/limite do revisor, sem ação.

Se houver **qualquer** item de decisão humana: apresente a triagem por item (o que vai, o que não vai, por quê) com sua recomendação, faça **só as perguntas necessárias** e espere. Os itens "resolver" podem seguir em paralelo se forem independentes dos que aguardam decisão. Se **nenhum** item exigir decisão, vá direto ao passo 3 sem pedir confirmação.

## 3. Corrigir

- Para bug: teste que **falhe no SHA revisado** e passe depois (provar rodando contra a versão antiga). Para concorrência, duas conexões reais (`pg`), como em `atendimento-mensagens-concorrencia.repository.test.ts`.
- Corrija o **princípio**, não só o exemplo citado: `grep` da classe do problema no repo todo e em arquivos irmãos; releia o `git diff` das próprias edições de texto.
- Preserve os controles existentes; nunca enfraqueça, exclua ou pule teste, nem use retry para ficar verde.
- Migration já na `develop` nunca é editada; migration nova da própria PR com timestamp antes de uma da `develop` é renomeada para depois (e atualize referências).
- Valide antes de commitar: `npx tsc --noEmit`, `npx eslint` e `npx prettier --check` nos arquivos tocados, testes unitários afetados e, para banco, `npx supabase db reset` + `npx jest --selectProjects integration --runInBand <caminho em src/>` (sempre com caminho em `src/`: sem ele o Jest pega cópias em `.claude/worktrees/`). Se o Supabase local estiver parado, `npx supabase start`.
- Commits pequenos, por apontamento, com `(#issue, PR #n Fx)` no título e o trailer `Co-Authored-By` exigido pelo ambiente.

## 4. Pedir permissão para o push

Use `AskUserQuestion` (uma pergunta): resumo do que foi corrigido, o que ficou de fora e **se o push precisa de force** (branch rebaseada/histórico reescrito → `--force-with-lease` com o SHA remoto esperado, nos dois remotes). Sem "sim", não publique, não comente, não gere PDF final. Nunca ofereça push antes de ter corrigido e validado.

## 5. Publicar (só após o "sim")

1. `git fetch origin`; compare com o remoto. Fast-forward → `git push origin <branch>`; divergente por rebase conhecido → `git push --force-with-lease=<branch>:<sha-remoto-esperado> origin <branch>`; qualquer outra divergência → pare e relate.
2. Confirme `gh pr view <n> --json headRefOid,commits`.
3. Comente na PR (`gh pr comment <n> --body-file`), no formato da casa: `## Devolutiva <k> — resposta (head <sha-antigo> → <sha-novo>)`, uma linha de síntese, um parágrafo por apontamento (ID em negrito, o que mudou com `arquivo:linha`/SHA, evidência), **Limite:** do que não foi coberto/verificado, e **Antes de produção:** quando houver. Honesto: o que não foi executado (CI recém-disparado, QA, ambiente remoto) é dito como tal.
4. Gere o PDF no modelo da devolutiva recebida:
   `python -I .claude/skills/revisar-pr/gerar_pdf.py <entrada.md> "C:\Users\csbet\Downloads\Resposta_Devolutiva_PR<n>_Rigoni_Contabil.pdf" --pr <n> --titulo "Resposta à devolutiva <k>" --subtitulo "<título da PR> • head <sha>" --status "<ex.: F1 E G2 CORRIGIDOS; O1 AGUARDA ACEITE>"`
   Estrutura do markdown (espelha o PDF recebido): parágrafo de síntese; `## Resumo da resposta` (tabela Item · Classificação · Decisão); uma `## <ID> • <título>` por apontamento (Causa/Correção/Evidência em `###` quando ajudar, tabelas para sequências, `> nota` para limites); `## Validação` (o que rodou e o que não); `## Antes de produção` se houver. Renderize a 1ª página para PNG e confira o resultado com `Read`. O PDF fica em `Downloads`, como nas rodadas anteriores (nome `Resposta_Revalidacao<k>_PR<n>…` quando a rodada for revalidação).
5. Confira o CI do novo head (`gh pr checks <n>`); se ainda pendente, diga isso — não declare verde.

## 6. Fechamento

Reporte em poucas linhas: SHAs, link do comentário, caminho do PDF, o que **não** foi conferido. Grave memória `project_pr<n>_devolutiva<k>.md` e **acrescente** a linha no topo de `MEMORY.md` (leia o arquivo inteiro e prependa, nunca sobrescreva). Nunca feche issue aqui (só no merge — ver `/aprovar-pr`).

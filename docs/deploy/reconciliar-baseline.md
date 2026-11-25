# Reconciliar o histórico de migrations com o baseline

O commit `d69d065f` trocou as 43 migrations de `20260924190000` a `20261029150000` pela `20261030090000_baseline.sql`. A produção e qualquer banco que já aplicou as antigas têm o schema do baseline, mas o histórico lista as 43 antigas. Sem reconciliar, o `supabase db push` tenta rodar o baseline de novo e falha em `create table`.

## Prova de equivalência

`db reset` só com o baseline e `db reset` só com as 43 antigas (as de `d69d065f^`), seguidos de `db dump --local`: os dois schemas são iguais, exceto comentários e a ordem dos `GRANT`.

A prova acima é local: não vale para um remoto. O `reconciliar-baseline.sql` só confere o histórico (as 43 versões), não o schema real; com drift manual, migration aplicada pela metade ou objeto ausente, ele passa e o `db push` nunca mais reaplica as antigas, escondendo a divergência. Por isso, **por ambiente**, os passos 1 a 3 são condição para o 4.

## Passos (uma vez por banco que já aplicou as antigas)

1. Backup recuperável: no painel do Supabase, Database → Backups, gere um backup e confirme que ele aparece como restaurável.
2. Histórico: `npx supabase link --project-ref <ref>` e `npx supabase migration list`; a coluna Remote deve listar exatamente as 43 versões de `20260924190000` a `20261029150000` (mais as posteriores ao baseline, se houver).
3. Schema remoto contra o baseline, sem escrita no remoto:
   - `npx supabase db dump --linked -f remoto.sql` (só o schema; não use `--data-only`).
   - Na máquina local: `npx supabase db reset` e `npx supabase db dump --local -f baseline.sql`, com a árvore só até o baseline (sem as migrations posteriores a `20261030090000`).
   - Compare `remoto.sql` com `baseline.sql` cobrindo tipos/enums, funções, triggers, policies, grants, índices e buckets (`storage.buckets`). Tolera-se só comentário e ordem de `GRANT`. Qualquer outra diferença bloqueia o passo 4: corrija o remoto ou o baseline e registre a decisão.
4. SQL Editor do projeto: rode `docs/deploy/reconciliar-baseline.sql`. O script só troca linhas de `supabase_migrations.schema_migrations`; nenhum dado de negócio é alterado ou apagado. Ele aborta sem mudar nada se o histórico não for exatamente o das 43 antigas.
5. A saída deve listar só `20261030090000`.
6. `npx supabase db push --dry-run`: devem aparecer só as migrations posteriores ao baseline (`20261030120000` em diante). Revise o plano; qualquer outra coisa interrompe aqui.
7. `npx supabase db push`.

Guarde, por ambiente, o resultado dos passos 2, 3 e 6 (listagem, diff e plano do dry-run) na PR ou no ticket do deploy.

Banco novo ou resetado (local, homologação recriada pelo E2E Preview) não precisa deste passo.

# Reconciliar o histórico de migrations com o baseline

O commit `d69d065f` trocou as 43 migrations de `20260924190000` a `20261029150000` pela `20261030090000_baseline.sql`. A produção e qualquer banco que já aplicou as antigas têm o schema do baseline, mas o histórico lista as 43 antigas. Sem reconciliar, o `supabase db push` tenta rodar o baseline de novo e falha em `create table`.

## Prova de equivalência

`db reset` só com o baseline e `db reset` só com as 43 antigas (as de `d69d065f^`), seguidos de `db dump --local`: os dois schemas são iguais, exceto comentários e a ordem dos `GRANT`.

## Passos (uma vez por banco que já aplicou as antigas)

1. Backup: no painel do Supabase, Database → Backups, gere um backup antes de começar.
2. SQL Editor do projeto: rode `docs/deploy/reconciliar-baseline.sql`. O script só troca linhas de `supabase_migrations.schema_migrations`; nenhum dado de negócio é alterado ou apagado. Ele aborta sem mudar nada se o histórico não for exatamente o das 43 antigas.
3. A saída deve listar só `20261030090000`.
4. `npx supabase link --project-ref <ref>` e `npx supabase db push --dry-run`: devem aparecer só as migrations posteriores ao baseline (`20261030120000` em diante).
5. `npx supabase db push`.

Banco novo ou resetado (local, homologação recriada pelo E2E Preview) não precisa deste passo.

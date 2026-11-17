# Foto do avatar: bucket, coluna e migration pendente nos bancos remotos

A foto do avatar (ADR 0012) fica no bucket privado `avatares` do Supabase Storage, um objeto por usuário
(nome = `{usuario_id}`, sobrescrito), só `image/webp` de até 256 KB. A coluna `perfis.avatar_atualizado_em`
(nulo = sem foto) diz quando foi gravada. As duas coisas só são escritas pelo servidor, com service role,
depois da autorização: nenhuma policy de `storage.objects` serve `authenticated` nem `anon`, e o gatilho
`perfis_proteger_avatar` recusa (erro `23514`) qualquer sessão de usuário, Admin inclusive, que grave a coluna
(ADR 0008).

## Migration pendente nos bancos remotos

`supabase/migrations/20261117100000_avatar_bucket_e_coluna.sql` precisa estar nos bancos remotos **antes do
deploy** que traz o envio de foto, junto das migrations que já estão pendentes lá. Sem ela, o envio de foto
falha (não há bucket nem coluna). Aplicar em Homologação e depois em Produção, na ordem dos timestamps:

```
supabase link --project-ref <ref-do-projeto>
supabase db push
```

Conferir depois: o bucket `avatares` existe e é privado, e `select avatar_atualizado_em from perfis limit 1`
responde.

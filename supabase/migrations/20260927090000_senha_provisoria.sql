-- Ticket #31: troca obrigatoria de senha no primeiro login.
-- senha_trocada_em nula = ainda esta na senha provisoria do #30.
-- senha_provisoria_expira_em: vencimento em 48h (decisao revisada no #19).
alter table public.perfis
  add column senha_trocada_em timestamptz,
  add column senha_provisoria_expira_em timestamptz not null default (now() + interval '48 hours');

-- Sem policy de UPDATE em perfis (nenhuma foi criada ate aqui): em vez de abrir
-- uma generica "dono pode atualizar o proprio perfil" (deixaria papel/setor
-- editaveis pelo proprio usuario), uma funcao SECURITY DEFINER estreita,
-- so pra esta coluna -- mesmo padrao de meu_papel()/meu_setor().
create or replace function public.marcar_senha_trocada()
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfis set senha_trocada_em = now() where id = auth.uid();
$$;

grant execute on function public.marcar_senha_trocada() to authenticated;

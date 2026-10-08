-- #58: usuário desativado (`perfis.desativado_em`) sai do Balanceamento mensal. Mesma assinatura e
-- retorno de `funcionarios_do_setor` (#45): só o filtro `desativado_em is null` entra.
create or replace function public.funcionarios_do_setor(p_setor public.setor_slug)
returns table (id uuid, atendimentos_no_mes bigint, livre boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    count(a.id) filter (
      where a.assumido_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
                             at time zone 'America/Sao_Paulo'
    ),
    not coalesce(bool_or(a.status = 'em_andamento'), false)
  from public.perfis p
  left join public.atendimentos a on a.funcionario_id = p.id
  where p.setor = p_setor and p.desativado_em is null
  group by p.id, p.nome
  order by p.nome, p.id;
$$;
revoke all on function public.funcionarios_do_setor(public.setor_slug) from public, anon, authenticated;

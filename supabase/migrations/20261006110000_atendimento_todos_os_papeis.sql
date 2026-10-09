-- #45: qualquer perfil do Setor (Admin, Líder de setor ou Funcionário) pode assumir Atendimento
-- e entra no Balanceamento mensal; antes só `papel = 'funcionario'` entrava. Mesma assinatura e
-- retorno de `funcionarios_do_setor` (#44): só o filtro por papel sai.
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
  where p.setor = p_setor
  group by p.id, p.nome
  order by p.nome, p.id;
$$;
revoke all on function public.funcionarios_do_setor(public.setor_slug) from public, anon, authenticated;

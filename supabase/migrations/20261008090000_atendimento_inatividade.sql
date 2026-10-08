-- #73: aviso e encerramento por inatividade. O aviso enviado fica no Atendimento: `de` é quem estava
-- inativo (a tela do Funcionário lê daqui o aviso dele). Mensagem nova de quem estava inativo o
-- cancela (quem decide é o job, comparando com a última Mensagem de cada lado).
alter table public.atendimentos
  add column aviso_inatividade_em timestamptz,
  add column aviso_inatividade_de public.autor_mensagem,
  add check ((aviso_inatividade_em is null) = (aviso_inatividade_de is null)),
  add check (aviso_inatividade_de in ('contato', 'funcionario'));

-- Atendimentos em andamento com Funcionário (os da Fila não têm quem esteja inativo).
create function public.atendimentos_para_inatividade()
returns table (
  id uuid,
  setor public.setor_slug,
  funcionario_id uuid,
  telefone text,
  chave_telefone text,
  ultima_do_contato timestamptz,
  ultima_do_funcionario timestamptz,
  aviso_inatividade_em timestamptz,
  aviso_inatividade_de public.autor_mensagem
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id, a.setor, a.funcionario_id, a.telefone, a.chave_telefone,
    max(m.criado_em) filter (where m.autor = 'contato'),
    max(m.criado_em) filter (where m.autor = 'funcionario'),
    a.aviso_inatividade_em, a.aviso_inatividade_de
  from public.atendimentos a
  left join public.mensagens m on m.atendimento_id = a.id
  where a.status = 'em_andamento' and a.funcionario_id is not null
  group by a.id;
$$;
revoke all on function public.atendimentos_para_inatividade() from public, anon, authenticated;

-- Marca o aviso uma vez só: false se já estava marcado (job repetido não reenvia).
create function public.marcar_aviso_inatividade(
  p_atendimento_id uuid,
  p_de public.autor_mensagem
) returns boolean
language sql
security invoker
set search_path = public
as $$
  with marcado as (
    update public.atendimentos
    set aviso_inatividade_em = clock_timestamp(), aviso_inatividade_de = p_de
    where id = p_atendimento_id and status = 'em_andamento' and aviso_inatividade_em is null
    returning 1
  )
  select exists (select 1 from marcado);
$$;
revoke all on function public.marcar_aviso_inatividade(uuid, public.autor_mensagem)
  from public, anon, authenticated;

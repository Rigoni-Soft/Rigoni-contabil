-- #73: aviso e encerramento por inatividade. O aviso enviado fica no Atendimento: `de` é quem estava
-- inativo (a tela do Funcionário lê daqui o aviso dele). Mensagem nova de quem estava inativo o
-- cancela (quem decide é o job, comparando com a última Mensagem de cada lado).
alter table public.atendimentos
  add column aviso_inatividade_em timestamptz,
  add column aviso_inatividade_de public.autor_mensagem,
  add check ((aviso_inatividade_em is null) = (aviso_inatividade_de is null)),
  add check (aviso_inatividade_de in ('contato', 'funcionario'));

-- Atendimento em aviso de inatividade não muda de dono nem de Setor (a Transferência é recusada
-- antes, no caso de uso; isto fecha a corrida entre a leitura e a gravação).
create function public.atendimento_em_aviso_nao_muda_de_dono()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.aviso_inatividade_em is not null
     and (new.funcionario_id is distinct from old.funcionario_id or new.setor <> old.setor) then
    raise exception 'Atendimento em aviso de inatividade nao pode ser transferido.';
  end if;
  return new;
end;
$$;
create trigger atendimento_em_aviso_nao_muda_de_dono
  before update of funcionario_id, setor on public.atendimentos
  for each row execute function public.atendimento_em_aviso_nao_muda_de_dono();

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
  group by a.id
  order by a.id;
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

-- Encerra só se o aviso continua marcado e quem estava inativo não escreveu depois dele; senão
-- 'inexistente' (o job tenta de novo na próxima rodada). Sob o lock do Setor, como o encerramento.
create function public.encerrar_atendimento_por_inatividade(
  p_atendimento_id uuid,
  p_funcionario_id uuid,
  p_ator uuid,
  p_ator_setor public.setor_slug
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setor public.setor_slug;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  if not exists (
    select 1 from public.atendimentos a
    where a.id = p_atendimento_id and a.aviso_inatividade_em is not null
      and not exists (
        select 1 from public.mensagens m
        where m.atendimento_id = a.id and m.autor = a.aviso_inatividade_de
          and m.criado_em > a.aviso_inatividade_em
      )
  ) then
    return jsonb_build_object('status', 'inexistente');
  end if;
  return public.encerrar_atendimento(p_atendimento_id, p_funcionario_id, p_ator, p_ator_setor);
end;
$$;
revoke all on function public.encerrar_atendimento_por_inatividade(uuid, uuid, uuid, public.setor_slug)
  from public, anon, authenticated;

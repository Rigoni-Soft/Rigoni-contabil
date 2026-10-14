-- #73 (devolutiva 2 da PR #83, B5): a mensagem final do encerramento é reivindicada por um job
-- por vez. `encerramento_reivindicado_em` é o lease: enquanto novo, outro job não a vê; vencido
-- (o job caiu), volta a ser elegível. A leitura é em lotes, sem o teto de linhas do PostgREST.
alter table public.atendimentos add column encerramento_reivindicado_em timestamptz;

drop function public.encerramentos_pendentes();

create function public.reivindicar_encerramentos_pendentes(
  p_limite int,
  p_lease interval default interval '10 minutes'
)
returns table (id uuid, telefone text, texto text)
language sql
security invoker
set search_path = public
as $$
  with alvo as (
    select a.id from public.atendimentos a
    where a.status = 'encerrado' and a.encerramento_pendente
      and (a.encerramento_reivindicado_em is null
           or a.encerramento_reivindicado_em < clock_timestamp() - p_lease)
    order by a.id
    limit p_limite
    for update skip locked
  ),
  reivindicado as (
    update public.atendimentos a
    set encerramento_reivindicado_em = clock_timestamp()
    from alvo
    where a.id = alvo.id
    returning a.id, a.telefone
  )
  select r.id, r.telefone, (
    select m.texto from public.mensagens m
    where m.atendimento_id = r.id and m.autor = 'ura'
    order by m.criado_em desc, m.id desc
    limit 1
  )
  from reivindicado r
  order by r.id;
$$;
revoke all on function public.reivindicar_encerramentos_pendentes(int, interval)
  from public, anon, authenticated;

-- O envio falhou: devolve a reivindicação para a próxima rodada, sem esperar o lease.
create function public.liberar_encerramento_pendente(p_atendimento_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.atendimentos set encerramento_reivindicado_em = null
  where id = p_atendimento_id and encerramento_pendente;
$$;
revoke all on function public.liberar_encerramento_pendente(uuid) from public, anon, authenticated;

create or replace function public.confirmar_encerramento_entregue(p_atendimento_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with confirmado as (
    update public.atendimentos
    set encerramento_pendente = false, encerramento_reivindicado_em = null
    where id = p_atendimento_id and encerramento_pendente
    returning 1
  )
  select exists (select 1 from confirmado);
$$;

-- Quem encerra já nasce com a reivindicação da própria mensagem final (entrega logo em seguida):
-- um segundo job não a pega no meio.
create or replace function public.encerrar_atendimento_por_inatividade(
  p_atendimento_id uuid,
  p_funcionario_id uuid,
  p_ator uuid,
  p_ator_setor public.setor_slug,
  p_texto_final text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_setor public.setor_slug;
  v_resultado jsonb;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  perform 1 from public.atendimentos a
  where a.id = p_atendimento_id and a.status = 'em_andamento'
    and a.aviso_inatividade_em is not null and a.aviso_entregue_em is not null
  for update;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;
  if exists (
    select 1 from public.atendimentos a
    join public.mensagens m on m.atendimento_id = a.id
    where a.id = p_atendimento_id and m.autor = a.aviso_inatividade_de
      and m.criado_em > a.aviso_inatividade_em
  ) then
    return jsonb_build_object('status', 'inexistente');
  end if;

  v_resultado := public.encerrar_atendimento(
    p_atendimento_id, p_funcionario_id, p_ator, p_ator_setor
  );
  if v_resultado ->> 'status' = 'encerrado' then
    insert into public.mensagens (atendimento_id, autor, texto)
    values (p_atendimento_id, 'ura', p_texto_final);
    update public.atendimentos
    set encerramento_pendente = true, encerramento_reivindicado_em = clock_timestamp()
    where id = p_atendimento_id;
  end if;
  return v_resultado;
end;
$$;

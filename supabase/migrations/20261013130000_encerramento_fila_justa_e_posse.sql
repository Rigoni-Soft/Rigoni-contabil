-- #73 (revalidação 3 da PR #83): a reivindicação da mensagem final do encerramento ganha
--   (1) rodízio justo: quem falha vai para o fim da fila, com backoff exponencial (um destinatário
--       que falha sempre não monopoliza os lotes nem repete a cada rodada do job);
--   (2) posse: a reivindicação emite um token e liberar/confirmar o exigem (um job cujo lease venceu
--       não mexe na reivindicação de outro).
alter table public.atendimentos
  add column encerramento_reivindicacao uuid,
  add column encerramento_tentativa_em timestamptz,
  add column encerramento_tentativas int not null default 0;

drop function public.reivindicar_encerramentos_pendentes(int, interval);

-- Elegível: pendente, sem lease vigente e com o backoff cumprido (a espera cresce com as tentativas:
-- base * 2^(tentativas - 1), até o teto). Nunca tentadas primeiro, depois a tentativa mais antiga:
-- quem falhou de novo entra atrás de todos os outros.
create function public.reivindicar_encerramentos_pendentes(
  p_limite int,
  p_lease interval default interval '10 minutes',
  p_backoff_base interval default interval '1 minute',
  p_backoff_teto interval default interval '6 hours'
)
returns table (id uuid, telefone text, texto text, reivindicacao uuid)
language sql
security invoker
set search_path = public
as $$
  with alvo as (
    select a.id from public.atendimentos a
    where a.status = 'encerrado' and a.encerramento_pendente
      and (a.encerramento_reivindicado_em is null
           or a.encerramento_reivindicado_em < clock_timestamp() - p_lease)
      and (a.encerramento_tentativa_em is null
           or a.encerramento_tentativa_em < clock_timestamp() - least(
                p_backoff_base * power(2, greatest(a.encerramento_tentativas - 1, 0)),
                p_backoff_teto))
    order by a.encerramento_tentativa_em nulls first, a.id
    limit p_limite
    for update skip locked
  ),
  reivindicado as (
    update public.atendimentos a
    set encerramento_reivindicado_em = clock_timestamp(),
        encerramento_reivindicacao = gen_random_uuid(),
        encerramento_tentativa_em = clock_timestamp(),
        encerramento_tentativas = a.encerramento_tentativas + 1
    from alvo
    where a.id = alvo.id
    returning a.id, a.telefone, a.encerramento_reivindicacao
  )
  select r.id, r.telefone, (
    select m.texto from public.mensagens m
    where m.atendimento_id = r.id and m.autor = 'ura'
    order by m.criado_em desc, m.id desc
    limit 1
  ), r.encerramento_reivindicacao
  from reivindicado r
  order by r.id;
$$;
revoke all on function public.reivindicar_encerramentos_pendentes(int, interval, interval, interval)
  from public, anon, authenticated;

-- O envio falhou: devolve a reivindicação, sem esperar o lease. Só quem a detém (mesmo token) a
-- devolve; as tentativas e a data da última ficam (é o que ordena e espaça a próxima).
drop function public.liberar_encerramento_pendente(uuid);
create function public.liberar_encerramento_pendente(
  p_atendimento_id uuid,
  p_reivindicacao uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.atendimentos
  set encerramento_reivindicado_em = null, encerramento_reivindicacao = null
  where id = p_atendimento_id and encerramento_pendente
    and encerramento_reivindicacao = p_reivindicacao;
$$;
revoke all on function public.liberar_encerramento_pendente(uuid, uuid)
  from public, anon, authenticated;

-- Entregue: false se a posse já não é de quem confirma (o lease venceu e outro job a tomou).
drop function public.confirmar_encerramento_entregue(uuid);
create function public.confirmar_encerramento_entregue(
  p_atendimento_id uuid,
  p_reivindicacao uuid
)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with confirmado as (
    update public.atendimentos
    set encerramento_pendente = false,
        encerramento_reivindicado_em = null,
        encerramento_reivindicacao = null
    where id = p_atendimento_id and encerramento_pendente
      and encerramento_reivindicacao = p_reivindicacao
    returning 1
  )
  select exists (select 1 from confirmado);
$$;
revoke all on function public.confirmar_encerramento_entregue(uuid, uuid)
  from public, anon, authenticated;

-- Quem encerra já nasce com a reivindicação (e o token) da própria mensagem final, que devolve.
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
  v_reivindicacao uuid := gen_random_uuid();
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
    set encerramento_pendente = true,
        encerramento_reivindicado_em = clock_timestamp(),
        encerramento_reivindicacao = v_reivindicacao,
        encerramento_tentativa_em = clock_timestamp(),
        encerramento_tentativas = 1
    where id = p_atendimento_id;
    v_resultado := v_resultado || jsonb_build_object('reivindicacao', v_reivindicacao);
  end if;
  return v_resultado;
end;
$$;

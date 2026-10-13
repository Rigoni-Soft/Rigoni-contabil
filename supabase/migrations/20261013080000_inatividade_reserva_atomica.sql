-- #73 (devolutiva da PR #83): o aviso é reservado antes de ser enviado, só se encerra com o aviso
-- entregue, a resposta que chega e o encerramento se serializam pela linha do Atendimento, e a
-- mensagem final da URA entra no histórico na mesma transação que fecha.
--
-- `aviso_entregue_em`: quando o aviso chegou a quem estava inativo. O aviso ao Funcionário é só a
-- marca (a tela dele a lê), então nasce entregue; o do cliente é confirmado depois do envio.
-- `encerramento_pendente`: a mensagem final já está no histórico, mas ainda não foi entregue ao
-- cliente (o job reenvia mesmo com o Atendimento encerrado).
alter table public.atendimentos
  add column aviso_entregue_em timestamptz,
  add column encerramento_pendente boolean not null default false,
  add check (aviso_entregue_em is null or aviso_inatividade_em is not null);

create index atendimentos_encerramento_pendente on public.atendimentos (id)
  where encerramento_pendente;

-- A desativação do dono limpa o aviso: junto, a entrega.
create or replace function public.atendimento_em_aviso_nao_muda_de_dono()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.aviso_inatividade_em is not null
     and (new.funcionario_id is distinct from old.funcionario_id or new.setor <> old.setor) then
    if coalesce(current_setting('rigoni.devolucao_por_desativacao', true), '') = 'on' then
      new.aviso_inatividade_em := null;
      new.aviso_inatividade_de := null;
      new.aviso_entregue_em := null;
      return new;
    end if;
    raise exception 'Atendimento em aviso de inatividade nao pode ser transferido.';
  end if;
  return new;
end;
$$;

-- A Mensagem do contato entra sob lock da linha do Atendimento: ou entra antes do encerramento
-- decidir (e o cancela) ou encontra o Atendimento já encerrado e não anexa (quem chamou abre outro
-- fluxo), nunca no meio.
create or replace function public.anexar_mensagem_atendimento(
  p_chave text,
  p_autor public.autor_mensagem,
  p_texto text
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.atendimentos
  where chave_telefone = p_chave and status = 'em_andamento'
  order by criado_em desc
  limit 1
  for update;
  if v_id is null then
    return false;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto) values (v_id, p_autor, p_texto);
  return true;
end;
$$;

-- Passa a trazer se o aviso foi entregue (o job não encerra sem isso).
drop function public.atendimentos_para_inatividade();
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
  aviso_inatividade_de public.autor_mensagem,
  aviso_entregue_em timestamptz
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
    a.aviso_inatividade_em, a.aviso_inatividade_de, a.aviso_entregue_em
  from public.atendimentos a
  left join public.mensagens m on m.atendimento_id = a.id
  where a.status = 'em_andamento' and a.funcionario_id is not null
  group by a.id
  order by a.id;
$$;
revoke all on function public.atendimentos_para_inatividade() from public, anon, authenticated;

-- Reserva o aviso: true só se este chamador marcou. `p_visto_ate` é a última Mensagem que o job
-- leu; se entrou outra depois, a decisão é de uma leitura velha e a próxima rodada reavalia.
-- Sob lock da linha, como o anexo e o encerramento.
drop function public.marcar_aviso_inatividade(uuid, public.autor_mensagem);
create function public.marcar_aviso_inatividade(
  p_atendimento_id uuid,
  p_de public.autor_mensagem,
  p_visto_ate timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento' and aviso_inatividade_em is null
  for update;
  if not found then
    return false;
  end if;
  -- O job lê o instante em milissegundos (Date); a coluna guarda microssegundos.
  if exists (
    select 1 from public.mensagens m
    where m.atendimento_id = p_atendimento_id
      and date_trunc('milliseconds', m.criado_em) > p_visto_ate
  ) then
    return false;
  end if;
  update public.atendimentos
  set aviso_inatividade_em = clock_timestamp(),
      aviso_inatividade_de = p_de,
      aviso_entregue_em = case when p_de = 'funcionario' then clock_timestamp() else null end
  where id = p_atendimento_id;
  return true;
end;
$$;
revoke all on function public.marcar_aviso_inatividade(uuid, public.autor_mensagem, timestamptz)
  from public, anon, authenticated;

-- O aviso ao cliente saiu: confirma a entrega. false se o aviso já não existe (cancelado).
create function public.confirmar_aviso_entregue(p_atendimento_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with confirmado as (
    update public.atendimentos
    set aviso_entregue_em = clock_timestamp()
    where id = p_atendimento_id and status = 'em_andamento'
      and aviso_inatividade_em is not null and aviso_entregue_em is null
    returning 1
  )
  select exists (select 1 from confirmado);
$$;
revoke all on function public.confirmar_aviso_entregue(uuid) from public, anon, authenticated;

-- Encerra só com o aviso entregue e sem ação de quem estava inativo depois dele, sob o lock do
-- Setor (como o encerramento) e o da linha (como o anexo). A mensagem final da URA entra no
-- histórico aqui, na mesma transação; a entrega ao cliente fica pendente até o job confirmar.
drop function public.encerrar_atendimento_por_inatividade(uuid, uuid, uuid, public.setor_slug);
create function public.encerrar_atendimento_por_inatividade(
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
    update public.atendimentos set encerramento_pendente = true where id = p_atendimento_id;
  end if;
  return v_resultado;
end;
$$;
revoke all on function public.encerrar_atendimento_por_inatividade(
  uuid, uuid, uuid, public.setor_slug, text
) from public, anon, authenticated;

-- Encerramentos cuja mensagem final ainda não foi entregue ao cliente.
create function public.encerramentos_pendentes()
returns table (id uuid, telefone text, texto text)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.telefone, (
    select m.texto from public.mensagens m
    where m.atendimento_id = a.id and m.autor = 'ura'
    order by m.criado_em desc, m.id desc
    limit 1
  )
  from public.atendimentos a
  where a.status = 'encerrado' and a.encerramento_pendente
  order by a.id;
$$;
revoke all on function public.encerramentos_pendentes() from public, anon, authenticated;

create function public.confirmar_encerramento_entregue(p_atendimento_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with confirmado as (
    update public.atendimentos set encerramento_pendente = false
    where id = p_atendimento_id and encerramento_pendente
    returning 1
  )
  select exists (select 1 from confirmado);
$$;
revoke all on function public.confirmar_encerramento_entregue(uuid)
  from public, anon, authenticated;

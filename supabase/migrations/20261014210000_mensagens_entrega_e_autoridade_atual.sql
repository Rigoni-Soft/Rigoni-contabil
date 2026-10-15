-- Revalidação 1 da PR #85 (R85-01.A e R85-01.B).
--
-- A) A Mensagem do Funcionário revalida a autoridade do ator no perfil REAL, sob lock, em vez de
--    confiar em papel/setor passados pelo caller: um Líder desativado ou rebaixado entre o início da
--    requisição e a gravação deixa de poder gravar. Ordem de locks: perfil (`for share`) e depois a
--    linha do Atendimento, a mesma de desativar_usuario (perfil → atendimentos); alterar_papel só
--    trava o perfil, então não há inversão.
-- B) A intenção de envio deixa de ser uma Mensagem comum: nasce `pendente` e só vira `entregue` com o
--    aceite do adapter (ou `falha`). A linha nunca é apagada pela compensação (evidência de uma
--    entrega incerta, e o anexo continua referenciado). Só `entregue` conta como ação do
--    Funcionário na inatividade; `pendente` recente adia o aviso e o encerramento em vez de
--    cancelá-los ou deixá-los passar por cima do envio em andamento.

create type public.entrega_mensagem as enum ('pendente', 'entregue', 'falha');
-- O que já existe (do contato, da URA e dos Funcionários) foi entregue ou recebido.
alter table public.mensagens
  add column entrega public.entrega_mensagem not null default 'entregue';

drop function public.registrar_mensagem_do_funcionario(
  uuid, uuid, public.papel, public.setor_slug, text, jsonb
);
drop function public.desfazer_mensagem_do_funcionario(uuid);

-- jsonb: { status: 'registrada', id } | { status: 'encerrada' } | { status: 'sem_autoridade' }.
create function public.registrar_mensagem_do_funcionario(
  p_atendimento_id uuid,
  p_ator uuid,
  p_texto text,
  p_anexo jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_atendimento public.atendimentos;
  v_id uuid;
begin
  select * into v_perfil from public.perfis
  where id = p_ator and desativado_em is null and banido_em is null
  for share;
  if not found then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id
  for update;
  if not found or v_atendimento.status <> 'em_andamento' then
    return jsonb_build_object('status', 'encerrada');
  end if;
  -- Mesma regra de `podeTransferir`: dono, Líder do Setor onde o Atendimento está, ou Admin.
  if not (
    v_perfil.papel = 'admin'
    or (v_perfil.papel = 'lider_setor' and v_perfil.setor = v_atendimento.setor)
    or v_perfil.id is not distinct from v_atendimento.funcionario_id
  ) then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  insert into public.mensagens (
    atendimento_id, autor, funcionario_id, texto, entrega,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, 'funcionario', p_ator, p_texto, 'pendente',
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  returning id into v_id;
  return jsonb_build_object('status', 'registrada', 'id', v_id);
end;
$$;

-- Fecha a intenção: true se saiu de `pendente`. Idempotente (reentrega de confirmação não muda nada).
create function public.finalizar_entrega_mensagem_do_funcionario(
  p_id uuid,
  p_entregue boolean
) returns boolean
language sql
security invoker
set search_path = public
as $$
  with finalizada as (
    update public.mensagens
    set entrega = case when p_entregue then 'entregue'::public.entrega_mensagem
                       else 'falha'::public.entrega_mensagem end
    where id = p_id and autor = 'funcionario' and entrega = 'pendente'
    returning 1
  )
  select exists (select 1 from finalizada);
$$;

revoke all on function
  public.registrar_mensagem_do_funcionario(uuid, uuid, text, jsonb),
  public.finalizar_entrega_mensagem_do_funcionario(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.registrar_mensagem_do_funcionario(uuid, uuid, text, jsonb),
  public.finalizar_entrega_mensagem_do_funcionario(uuid, boolean)
  to service_role;

-- Inatividade: só a Mensagem entregue conta como a última do Funcionário.
create or replace function public.atendimentos_para_inatividade()
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
    max(m.criado_em) filter (where m.autor = 'funcionario' and m.entrega = 'entregue'),
    a.aviso_inatividade_em, a.aviso_inatividade_de, a.aviso_entregue_em
  from public.atendimentos a
  left join public.mensagens m on m.atendimento_id = a.id
  where a.status = 'em_andamento' and a.funcionario_id is not null
  group by a.id
  order by a.id;
$$;

-- Reserva o aviso: uma Mensagem posterior à leitura do job (entregue, ou pendente recente: o envio
-- está em andamento e a decisão é de uma leitura velha) a adia para a próxima rodada.
create or replace function public.marcar_aviso_inatividade(
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
      and (m.entrega = 'entregue'
           or (m.entrega = 'pendente' and m.criado_em > clock_timestamp() - interval '5 minutes'))
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

-- Encerra só sem ação de quem estava inativo depois do aviso: Mensagem entregue, ou envio pendente
-- recente (não fecha por cima de uma resposta que está saindo).
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
      and (m.entrega = 'entregue'
           or (m.entrega = 'pendente' and m.criado_em > clock_timestamp() - interval '5 minutes'))
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

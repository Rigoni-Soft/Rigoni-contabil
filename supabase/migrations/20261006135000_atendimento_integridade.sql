-- Devolutiva técnica da PR #77 (B2, B3, I1): elegibilidade do atendente, ordem da Fila e crédito mensal.
--
-- B2: só perfil ATIVO e do Setor de destino recebe Atendimento, conferido dentro da operação (com
-- lock da linha do perfil: uma desativação concorrente espera ou é vista).
-- B3: quem tem alguém mais antigo e elegível na Fila (a do Setor ou a dele) assume o mais antigo
-- antes de o recém-chegado ser admitido; o recém-chegado espera na Fila.
-- I1: o Balanceamento mensal conta EVENTOS de assunção (tabela imutável), não o dono atual do
-- Atendimento: quem atendeu e transferiu continua com o crédito, e o destino ganha o dele ao assumir.

create table public.assuncoes_atendimento (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos (id) on delete cascade,
  funcionario_id uuid not null references public.perfis (id),
  assumido_em timestamptz not null default clock_timestamp()
);
create index assuncoes_atendimento_funcionario_mes
  on public.assuncoes_atendimento (funcionario_id, assumido_em);
alter table public.assuncoes_atendimento enable row level security;
revoke all on table public.assuncoes_atendimento from anon, authenticated;

-- Quem já era dono de um Atendimento ganha o crédito que o dado atual permite reconstruir.
insert into public.assuncoes_atendimento (atendimento_id, funcionario_id, assumido_em)
select id, funcionario_id, assumido_em from public.atendimentos
where funcionario_id is not null and assumido_em is not null;

-- Elegível a receber Atendimento do Setor: do Setor e não desativado. `for share` trava a linha do
-- perfil até o fim da transação: desativar essa conta no meio espera, e o que já foi desativado
-- é recusado aqui.
create function public.atendente_elegivel(p_funcionario uuid, p_setor public.setor_slug)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from public.perfis
  where id = p_funcionario and setor = p_setor and desativado_em is null
  for share;
  return found;
end;
$$;
revoke all on function public.atendente_elegivel(uuid, public.setor_slug)
  from public, anon, authenticated;

-- Funcionários ATIVOS do Setor com o crédito do mês (fuso de Brasília) e se estão livres.
create or replace function public.funcionarios_do_setor(p_setor public.setor_slug)
returns table (id uuid, atendimentos_no_mes bigint, livre boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    (
      select count(*) from public.assuncoes_atendimento s
      where s.funcionario_id = p.id
        and s.assumido_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
                             at time zone 'America/Sao_Paulo'
    ),
    not exists (
      select 1 from public.atendimentos a
      where a.funcionario_id = p.id and a.status = 'em_andamento'
    )
  from public.perfis p
  where p.setor = p_setor and p.desativado_em is null
  order by p.nome, p.id;
$$;
revoke all on function public.funcionarios_do_setor(public.setor_slug) from public, anon, authenticated;

-- Funcionário livre assume o Atendimento mais antigo da Fila do Setor ou da sua própria Fila,
-- ignorando o Balanceamento. Só um atendente elegível assume. QUEM CHAMA já segura o lock do Setor.
create or replace function public.assumir_proximo_da_fila(
  p_funcionario_id uuid,
  p_setor public.setor_slug
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_telefone text;
  v_chave text;
begin
  if not public.atendente_elegivel(p_funcionario_id, p_setor) then
    return null;
  end if;
  if exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_id and status = 'em_andamento'
  ) then
    return null;
  end if;

  select a.id, a.telefone, a.chave_telefone into v_id, v_telefone, v_chave
  from public.atendimentos a
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
    and (a.fila_funcionario_id is null or a.fila_funcionario_id = p_funcionario_id)
  order by a.fila_desde, a.id
  limit 1
  for update;
  if v_id is null then
    return null;
  end if;

  update public.atendimentos
  set funcionario_id = p_funcionario_id, fila_funcionario_id = null,
      fila_desde = null, assumido_em = now()
  where id = v_id;
  insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
  values (v_id, p_funcionario_id);

  return jsonb_build_object(
    'id', v_id, 'telefone', v_telefone, 'chave', v_chave,
    'funcionario_nome', (select nome from public.perfis where id = p_funcionario_id)
  );
end;
$$;

-- Abre o Atendimento. Funcionário escolhido inelegível (outro Setor ou desativado) ou ocupado:
-- devolve null sem gravar (quem chama escolhe de novo). Escolhido livre mas com alguém mais antigo
-- na Fila dele: o mais antigo assume (`promovido`) e o novo entra na Fila.
create or replace function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb,
  p_atribuir_livre boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_funcionario uuid := p_funcionario_id;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if v_funcionario is not null then
    if not public.atendente_elegivel(v_funcionario, p_setor) then
      return null;
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_funcionario and status = 'em_andamento'
    ) then
      return null;
    end if;
    v_promovido := public.assumir_proximo_da_fila(v_funcionario, p_setor);
    if v_promovido is not null then
      v_funcionario := null;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor and status = 'em_andamento' and funcionario_id is null
  ) then
    v_funcionario := public.funcionario_livre_do_setor(p_setor);
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde
  ) values (
    p_telefone, p_chave, p_cliente_id, p_setor, v_funcionario,
    case when v_funcionario is null then null else clock_timestamp() end,
    case when v_funcionario is null then clock_timestamp() else null end
  )
  returning id into v_id;
  if v_funcionario is not null then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (v_id, v_funcionario);
  end if;

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object(
    'id', v_id, 'funcionario_id', v_funcionario, 'promovido', v_promovido
  );
end;
$$;

-- Transfere. Destino inelegível (outro Setor ou desativado): "conflito", sem mudar nada. Destino
-- livre mas com alguém mais antigo na Fila dele (a do Setor de destino ou a pessoal): o mais antigo
-- assume (`promovido`) e o transferido espera na Fila (a pessoal do destino fixo, ou a do Setor).
create or replace function public.transferir_atendimento(
  p_atendimento_id uuid,
  p_origem_funcionario_id uuid,
  p_setor_destino public.setor_slug,
  p_funcionario_destino_id uuid,
  p_resumo text,
  p_ator uuid,
  p_ator_setor public.setor_slug,
  p_enfileirar_se_ocupado boolean,
  p_setor_origem public.setor_slug,
  p_atribuir_livre boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_atendimento public.atendimentos;
  v_contato_nome text;
  v_empresa text;
  v_cnpj text;
  v_na_fila boolean := false;
  v_destino uuid := p_funcionario_destino_id;
  v_proximo jsonb;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtext('atendimento:' || least(p_setor_destino::text, p_setor_origem::text)));
  if p_setor_origem <> p_setor_destino then
    perform pg_advisory_xact_lock(
      hashtext('atendimento:' || greatest(p_setor_destino::text, p_setor_origem::text)));
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found
     or v_atendimento.funcionario_id is distinct from p_origem_funcionario_id
     or v_atendimento.setor is distinct from p_setor_origem then
    return jsonb_build_object('status', 'inexistente');
  end if;

  if v_destino is not null then
    if not public.atendente_elegivel(v_destino, p_setor_destino) then
      return jsonb_build_object('status', 'conflito');
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_destino and status = 'em_andamento'
        and id <> p_atendimento_id
    ) then
      if not p_enfileirar_se_ocupado then
        return jsonb_build_object('status', 'conflito');
      end if;
      v_na_fila := true;
    else
      v_promovido := public.assumir_proximo_da_fila(v_destino, p_setor_destino);
      if v_promovido is not null then
        if p_enfileirar_se_ocupado then
          v_na_fila := true;
        else
          v_destino := null;
        end if;
      end if;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor_destino and status = 'em_andamento' and funcionario_id is null
  ) then
    v_destino := public.funcionario_livre_do_setor(p_setor_destino);
  end if;

  -- Na fila de um usuário: sem dono ainda (funcionario_id e assumido_em nulos) e
  -- `fila_funcionario_id` aponta quem vai atender; fila do Setor = os dois nulos.
  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = case when v_na_fila then null else v_destino end,
      fila_funcionario_id = case when v_na_fila then v_destino else null end,
      assumido_em = case
        when v_na_fila or v_destino is null then null else clock_timestamp() end,
      fila_desde = case
        when v_na_fila or v_destino is null then clock_timestamp() else null end
  where id = p_atendimento_id;
  if v_destino is not null and not v_na_fila then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (p_atendimento_id, v_destino);
  end if;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, v_destino, btrim(p_resumo)
  );

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.transferir',
    p_atendimento_id::text, 'sucesso'
  );

  if v_atendimento.cliente_id is not null then
    select c.empresa, c.cnpj into v_empresa, v_cnpj
    from public.clientes c where c.id = v_atendimento.cliente_id;
    select ct.nome into v_contato_nome
    from public.cliente_contatos ct
    where ct.cliente_id = v_atendimento.cliente_id
      and regexp_replace(ct.telefone, '\D', '', 'g') = v_atendimento.chave_telefone
    order by ct.padrao desc, ct.criado_em
    limit 1;
  end if;

  if p_origem_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_origem_funcionario_id, p_setor_origem);
  end if;

  return jsonb_build_object(
    'status', 'transferido',
    'proximo_da_origem', v_proximo,
    'promovido', v_promovido,
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = v_destino),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;

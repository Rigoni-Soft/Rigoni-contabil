-- #84: reagir com emoji à Mensagem do cliente. A reação vai ao cliente pelo id da Mensagem no
-- provedor (`id_externo`, o wamid da Cloud API), então ele passa a ser guardado na entrada. `reacao`
-- é a reação atual do escritório (uma por Mensagem; null = sem reação).
alter table public.mensagens
  add column id_externo text,
  add column reacao text check (length(btrim(reacao)) between 1 and 16);

-- Mesma assinatura: só o insert das Mensagens passa a gravar `idExterno` (chave do jsonb).
create or replace function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb,
  p_atribuir_livre boolean default false,
  p_resumo text default null,
  p_cnpj_informado text default null
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
  -- Mantém o que a PR #77 garante (atendente elegível, a Fila antiga na frente, crédito por
  -- assunção): esta função substitui a de `20261006135000_atendimento_integridade.sql`.
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
    -- Desativado entre a escolha e agora: revalida com lock (PR #77, 2ª devolutiva); inelegível
    -- não recebe, o Atendimento espera na Fila.
    if v_funcionario is not null
       and not public.atendente_elegivel(v_funcionario, p_setor) then
      v_funcionario := null;
    end if;
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde,
    resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave,
    coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado)),
    p_setor, v_funcionario,
    case when v_funcionario is null then null else clock_timestamp() end,
    case when v_funcionario is null then clock_timestamp() else null end,
    p_resumo, p_cnpj_informado
  )
  returning id into v_id;
  if v_funcionario is not null then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (v_id, v_funcionario);
  end if;

  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto', m ->> 'idExterno'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object(
    'id', v_id, 'funcionario_id', v_funcionario, 'promovido', v_promovido
  );
end;
$$;
-- A assinatura ganha p_id_externo: troca a função, mantendo o acesso só do service_role.
drop function public.anexar_mensagem_atendimento(text, public.autor_mensagem, text);
create function public.anexar_mensagem_atendimento(
  p_chave text,
  p_autor public.autor_mensagem,
  p_texto text,
  p_id_externo text default null
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
  limit 1;
  if v_id is null then
    return false;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  values (v_id, p_autor, p_texto, p_id_externo);
  return true;
end;
$$;
revoke all on function public.anexar_mensagem_atendimento(
  text, public.autor_mensagem, text, text
) from public, anon, authenticated;

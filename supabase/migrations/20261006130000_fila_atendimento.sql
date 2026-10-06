-- #47: Fila. Atendimento sem Funcionário (`funcionario_id` null) é o estado "na fila": a do Setor
-- (`fila_funcionario_id` null) ou a de um usuário (destino fixo ocupado, #45). `fila_desde` marca
-- a entrada na Fila (não `criado_em`: um Atendimento transferido espera desde a Transferência) e
-- ordena a saída por antiguidade.
alter table public.atendimentos add column fila_desde timestamptz;
update public.atendimentos set fila_desde = criado_em
where funcionario_id is null and status = 'em_andamento';

-- Funcionário livre do Setor com menos Atendimentos no mês (empate: ordem de `funcionarios_do_setor`),
-- ou null. Serve a quem entra na Fila de Setor já sob o lock dele: se um Funcionário foi liberado
-- depois que o chamador listou e a Fila estava vazia, ninguém o promoveria; então o recém-chegado
-- o assume em vez de esperar parado.
create function public.funcionario_livre_do_setor(p_setor public.setor_slug) returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from (
    select f.*, row_number() over () as ordem from public.funcionarios_do_setor(p_setor) f
  ) t
  where livre
  order by atendimentos_no_mes, ordem
  limit 1;
$$;
revoke all on function public.funcionario_livre_do_setor(public.setor_slug)
  from public, anon, authenticated;

-- Atendimento novo sem Funcionário escolhido entra na Fila agora (`clock_timestamp`, não `now`: a
-- ordem da Fila é a da entrada sob o lock, não a do início da transação). Com
-- `p_atribuir_livre` e ninguém na frente, um Funcionário livre do Setor (liberado depois que o
-- chamador listou) é assumido em vez de ficar ocioso. Devolve jsonb com o id e o Funcionário que
-- ficou com o Atendimento (null = Fila), ou null se o Funcionário escolhido foi ocupado.
drop function public.abrir_atendimento(
  text, text, uuid, public.setor_slug, uuid, jsonb
);
create function public.abrir_atendimento(
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
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if v_funcionario is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = v_funcionario and status = 'em_andamento'
  ) then
    return null;
  end if;
  if v_funcionario is null and p_atribuir_livre and not exists (
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

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object('id', v_id, 'funcionario_id', v_funcionario);
end;
$$;
revoke all on function public.abrir_atendimento(
  text, text, uuid, public.setor_slug, uuid, jsonb, boolean
) from public, anon, authenticated;

-- Funcionário livre assume o Atendimento mais antigo da Fila do Setor ou da sua própria Fila,
-- ignorando o Balanceamento; `assumido_em` conta pro Balanceamento mensal dele. QUEM CHAMA já
-- segura o lock do Setor (é o que impede uma atribuição concorrente de furar a Fila) e libera o
-- Funcionário na mesma transação. Devolve o Atendimento assumido, ou null (ocupado ou Fila vazia).
create function public.assumir_proximo_da_fila(p_funcionario_id uuid, p_setor public.setor_slug)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_telefone text;
  v_chave text;
begin
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

  return jsonb_build_object(
    'id', v_id, 'telefone', v_telefone, 'chave', v_chave,
    'funcionario_nome', (select nome from public.perfis where id = p_funcionario_id)
  );
end;
$$;
revoke all on function public.assumir_proximo_da_fila(uuid, public.setor_slug)
  from public, anon, authenticated;

-- Igual à do #45, mas: o Atendimento que vai pra Fila ganha `fila_desde` (e o que sai dela, não);
-- e o Funcionário de origem, agora livre, assume o próximo da Fila do Setor onde estava, na mesma
-- transação (`proximo_da_origem`). Trava os dois Setores, sempre na mesma ordem (nome), pra duas
-- Transferências em sentidos opostos não ficarem uma esperando a outra.
drop function public.transferir_atendimento(
  uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean, public.setor_slug
);
create function public.transferir_atendimento(
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

  if v_destino is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = v_destino and status = 'em_andamento'
      and id <> p_atendimento_id
  ) then
    if not p_enfileirar_se_ocupado then
      return jsonb_build_object('status', 'conflito');
    end if;
    v_na_fila := true;
  elsif v_destino is null and p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor_destino and status = 'em_andamento' and funcionario_id is null
  ) then
    -- `p_atribuir_livre`, sem Funcionário escolhido e sem ninguém na frente: um Funcionário
    -- liberado depois da listagem do chamador não fica ocioso (ver `funcionario_livre_do_setor`).
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
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = v_destino),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;
revoke all on function public.transferir_atendimento(
  uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean, public.setor_slug,
  boolean
) from public, anon, authenticated;

-- Posição (1 = próximo) do Atendimento na Fila em que está: a do Setor ou a do usuário (a mesma
-- numeração de `fila_do_setor`). null se não está em Fila. ponytail: a Fila de um usuário e a do
-- Setor concorrem pelo mesmo Funcionário ao liberar (`assumir_proximo_da_fila`); cada Fila conta
-- só os seus, então a posição é um mínimo.
create function public.posicao_na_fila(p_atendimento_id uuid) returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.atendimentos a
  join public.atendimentos b
    on b.setor = a.setor and b.status = 'em_andamento' and b.funcionario_id is null
   and b.fila_funcionario_id is not distinct from a.fila_funcionario_id
   and (b.fila_desde, b.id) <= (a.fila_desde, a.id)
  where a.id = p_atendimento_id and a.status = 'em_andamento' and a.funcionario_id is null;
$$;
revoke all on function public.posicao_na_fila(uuid) from public, anon, authenticated;

-- A Fila do Setor (a do Setor e as de usuários), do mais antigo ao mais novo, com a posição em
-- cada Fila, o que já se sabe do Contato e o resumo da última Transferência.
create function public.fila_do_setor(p_setor public.setor_slug)
returns table (
  id uuid,
  posicao integer,
  fila_funcionario_id uuid,
  fila_desde timestamptz,
  telefone text,
  contato_nome text,
  empresa text,
  cnpj text,
  resumo text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    (row_number() over (partition by a.fila_funcionario_id order by a.fila_desde, a.id))::integer,
    a.fila_funcionario_id, a.fila_desde, a.telefone,
    (select ct.nome from public.cliente_contatos ct
      where ct.cliente_id = a.cliente_id
        and regexp_replace(ct.telefone, '\D', '', 'g') = a.chave_telefone
      order by ct.padrao desc, ct.criado_em limit 1),
    c.empresa, c.cnpj,
    (select t.resumo from public.transferencias t
      where t.atendimento_id = a.id order by t.criado_em desc limit 1)
  from public.atendimentos a
  left join public.clientes c on c.id = a.cliente_id
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
  order by a.fila_desde, a.id;
$$;
revoke all on function public.fila_do_setor(public.setor_slug) from public, anon, authenticated;

-- Encerra o Atendimento do Funcionário (null = um da Fila), grava a auditoria de sucesso e, se havia
-- Funcionário, libera ele pro próximo da Fila: tudo numa transação, sob o lock do Setor (mesmo
-- contrato de ator de `transferir_atendimento`). Devolve jsonb com `status`:
--  - 'inexistente': não está em andamento com esse dono (ou o Setor mudou no meio);
--  - 'encerrado': com `proximo`, o Atendimento que o Funcionário assumiu (ou null).
create function public.encerrar_atendimento(
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
  v_proximo jsonb;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  update public.atendimentos set status = 'encerrado'
  where id = p_atendimento_id and status = 'em_andamento' and setor = v_setor
    and funcionario_id is not distinct from p_funcionario_id;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.encerrar',
    p_atendimento_id::text, 'sucesso'
  );

  if p_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_funcionario_id, v_setor);
  end if;
  return jsonb_build_object('status', 'encerrado', 'proximo', v_proximo);
end;
$$;
revoke all on function public.encerrar_atendimento(uuid, uuid, uuid, public.setor_slug)
  from public, anon, authenticated;

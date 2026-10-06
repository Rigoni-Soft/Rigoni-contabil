-- #47: Fila. Atendimento sem Funcionário (`funcionario_id` null) é o estado "na fila": a do Setor
-- (`fila_funcionario_id` null) ou a de um usuário (destino fixo ocupado, #45). `fila_desde` marca
-- a entrada na Fila (não `criado_em`: um Atendimento transferido espera desde a Transferência) e
-- ordena a saída por antiguidade.
alter table public.atendimentos add column fila_desde timestamptz;
update public.atendimentos set fila_desde = criado_em
where funcionario_id is null and status = 'em_andamento';

-- Atendimento novo sem Funcionário livre entra na Fila agora.
create or replace function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if p_funcionario_id is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_id and status = 'em_andamento'
  ) then
    return null;
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde
  ) values (
    p_telefone, p_chave, p_cliente_id, p_setor, p_funcionario_id,
    case when p_funcionario_id is null then null else now() end,
    case when p_funcionario_id is null then now() else null end
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return v_id;
end;
$$;

-- Igual à do #45, mas o Atendimento que vai pra Fila ganha `fila_desde` (e o que sai dela, não).
create or replace function public.transferir_atendimento(
  p_atendimento_id uuid,
  p_origem_funcionario_id uuid,
  p_setor_destino public.setor_slug,
  p_funcionario_destino_id uuid,
  p_resumo text,
  p_ator uuid,
  p_ator_setor public.setor_slug,
  p_enfileirar_se_ocupado boolean,
  p_setor_origem public.setor_slug
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
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor_destino::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found
     or v_atendimento.funcionario_id is distinct from p_origem_funcionario_id
     or v_atendimento.setor is distinct from p_setor_origem then
    return jsonb_build_object('status', 'inexistente');
  end if;

  if p_funcionario_destino_id is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_destino_id and status = 'em_andamento'
      and id <> p_atendimento_id
  ) then
    if not p_enfileirar_se_ocupado then
      return jsonb_build_object('status', 'conflito');
    end if;
    v_na_fila := true;
  end if;

  -- Na fila de um usuário: sem dono ainda (funcionario_id e assumido_em nulos) e
  -- `fila_funcionario_id` aponta quem vai atender; fila do Setor = os dois nulos.
  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = case when v_na_fila then null else p_funcionario_destino_id end,
      fila_funcionario_id = case when v_na_fila then p_funcionario_destino_id else null end,
      assumido_em = case
        when v_na_fila or p_funcionario_destino_id is null then null else now() end,
      fila_desde = case
        when v_na_fila or p_funcionario_destino_id is null then now() else null end
  where id = p_atendimento_id;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, p_funcionario_destino_id, btrim(p_resumo)
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

  return jsonb_build_object(
    'status', 'transferido',
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = p_funcionario_destino_id),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;

-- Posição (1 = próximo) do Atendimento na Fila em que está: a do Setor ou a do usuário. null se não
-- está em Fila. ponytail: a Fila de um usuário e a do Setor concorrem pelo mesmo Funcionário ao
-- liberar (`liberar_funcionario`); aqui cada Fila conta só os seus, então a posição é um mínimo.
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

-- A Fila do Setor (a do Setor e as de usuários), do mais antigo ao mais novo, com o que já se sabe
-- do Contato e o resumo da última Transferência.
create function public.fila_do_setor(p_setor public.setor_slug)
returns table (
  id uuid,
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
    a.id, a.fila_funcionario_id, a.fila_desde, a.telefone,
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

-- Encerra o Atendimento do Funcionário (null = um da Fila) e grava a auditoria de sucesso na mesma
-- transação (mesmo contrato de `transferir_atendimento` para o ator). false = não está em andamento
-- com esse dono.
create function public.encerrar_atendimento(
  p_atendimento_id uuid,
  p_funcionario_id uuid,
  p_ator uuid,
  p_ator_setor public.setor_slug
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.atendimentos set status = 'encerrado'
  where id = p_atendimento_id and status = 'em_andamento'
    and funcionario_id is not distinct from p_funcionario_id;
  if not found then
    return false;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.encerrar',
    p_atendimento_id::text, 'sucesso'
  );
  return true;
end;
$$;
revoke all on function public.encerrar_atendimento(uuid, uuid, uuid, public.setor_slug)
  from public, anon, authenticated;

-- Funcionário livre assume o Atendimento mais antigo da Fila do Setor ou da sua própria Fila,
-- ignorando o Balanceamento. `assumido_em` conta pro Balanceamento mensal dele. Mesmo lock por
-- Setor das atribuições. Devolve o Atendimento assumido, ou null (já ocupado ou Fila vazia).
create function public.liberar_funcionario(p_funcionario_id uuid, p_setor public.setor_slug)
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
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
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
revoke all on function public.liberar_funcionario(uuid, public.setor_slug)
  from public, anon, authenticated;

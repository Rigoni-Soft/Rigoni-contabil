-- #164 (spec #160): Atendimento novo ou transferido cai na espera do Setor; ninguém é escolhido pelo
-- sistema. Saem o Balanceamento mensal, a promoção automática da fila ao liberar um Funcionário e a
-- posição na fila. `assuncoes_atendimento` fica como evento (sem efeito na distribuição). A espera
-- dirigida (Simples Nacional → Responsável ou Líder) segue em `fila_funcionario_id`.
-- Sem tabela nova: nenhum grant de tabela a conceder.

drop function public.abrir_atendimento(text, text, uuid, public.setor_slug, uuid, jsonb, boolean, text, text);
drop function public.transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean, public.setor_slug, boolean);
drop function public.fila_do_setor(public.setor_slug);
drop function public.posicao_na_fila(uuid);

CREATE FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text DEFAULT NULL::text, p_cnpj_informado text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, fila_desde, resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave,
    coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado)),
    p_setor, clock_timestamp(), p_resumo, p_cnpj_informado
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto', m ->> 'idExterno'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Encerra o Atendimento do Funcionário (null = um em espera), com a auditoria de sucesso. Devolve
-- 'inexistente' se não está em andamento com esse dono (ou o Setor mudou no meio). Quem encerra não
-- puxa mais ninguém da espera.
CREATE OR REPLACE FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
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
  return jsonb_build_object('status', 'encerrado');
end;
$$;

-- A espera (a do Setor e as dirigidas a um usuário), do mais antigo ao mais novo, com o que já se
-- sabe do Contato e o resumo da última Transferência.
CREATE FUNCTION public.fila_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, fila_funcionario_id uuid, fila_desde timestamp with time zone, telefone text, contato_nome text, empresa text, cnpj text, resumo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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

-- Transfere o Atendimento para a espera do Setor de destino, ou dirigida a `p_dirigido_a`
-- (Simples Nacional: Responsável do Cliente ou Líder). Dirigido inelegível (outro Setor ou
-- desativado): "conflito", sem mudar nada.
CREATE FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atendimento public.atendimentos;
  v_contato_nome text;
  v_empresa text;
  v_cnpj text;
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

  if p_dirigido_a is not null and not public.atendente_elegivel(p_dirigido_a, p_setor_destino) then
    return jsonb_build_object('status', 'conflito');
  end if;

  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = null,
      fila_funcionario_id = p_dirigido_a,
      assumido_em = null,
      fila_desde = clock_timestamp()
  where id = p_atendimento_id;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, p_dirigido_a, btrim(p_resumo)
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
    'destinatario_nome', (select nome from public.perfis where id = p_dirigido_a),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;

-- Como a anterior, sem o laço que punha Funcionário livre no mais antigo da fila: a desativação só
-- devolve à espera do Setor (o que esperava dirigido ao desativado também vai ao Setor).
CREATE OR REPLACE FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
  v_setor public.setor_slug;
begin
  select setor into v_setor from public.perfis where id = alvo_id;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_alvo from public.perfis where id = alvo_id for update;
  if v_alvo.desativado_em is not null then
    return;
  end if;

  select * into v_ator from public.perfis where id = ator_id;
  if not found then
    raise exception 'ator inexistente.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), v_ator.id, v_alvo.setor, 'usuario.desativar', v_alvo.email, 'sucesso', now());

  update public.perfis set desativado_em = now() where id = alvo_id;

  with removidos as (
    update public.cliente_cadastro_operacional_sn
    set responsavel_id = null
    where responsavel_id = alvo_id
    returning cliente_id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'cliente.remover-responsavel', c.cnpj, 'sucesso', now()
  from removidos r
  join public.clientes c on c.id = r.cliente_id;

  -- A marca vale só nesta transação: quem protege o dono do Atendimento (aviso de inatividade, #73)
  -- distingue a devolução da Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        fila_funcionario_id = null,
        assumido_em = null,
        -- Quem estava sendo atendido entra agora (atrás de quem já esperava); quem esperava
        -- dirigido ao desativado mantém a espera. Os `a.*` do SET são os valores de antes.
        fila_desde = case
          when a.funcionario_id = alvo_id then clock_timestamp()
          else coalesce(a.fila_desde, a.criado_em)
        end
    where a.status = 'em_andamento'
      and (a.funcionario_id = alvo_id or a.fila_funcionario_id = alvo_id)
    returning a.id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'atendimento.devolver-fila', d.id::text, 'sucesso', now()
  from devolvidos d;
  perform set_config('rigoni.devolucao_por_desativacao', 'off', true);
end;
$$;

drop function public.funcionario_livre_do_setor(public.setor_slug);
drop function public.assumir_proximo_da_fila(uuid, public.setor_slug);
drop function public.funcionarios_do_setor(public.setor_slug);

revoke all on function public.abrir_atendimento(text, text, uuid, public.setor_slug, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.abrir_atendimento(text, text, uuid, public.setor_slug, jsonb, text, text) to service_role;

revoke all on function public.fila_do_setor(public.setor_slug) from public, anon, authenticated;
grant execute on function public.fila_do_setor(public.setor_slug) to service_role;

revoke all on function public.transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, public.setor_slug) from public, anon, authenticated;
grant execute on function public.transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, public.setor_slug) to service_role;

-- #165: só o destinatário vê o Atendimento. A espera comum (sem destinatário) existe só na Recepção,
-- onde todos os Funcionários e o Líder respondem por todo cliente que chega. Nos demais Setores,
-- Atendimento sem Responsável nem Líder fica sem destinatário e só Admin e Líder o leem (supervisão):
-- ninguém o assume até haver Responsável ou Líder.

CREATE OR REPLACE FUNCTION public.assumir_atendimento(p_atendimento_id uuid, p_ator uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_atendimento public.atendimentos;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  v_setor := v_atendimento.setor;
  -- Elegibilidade antes do dono: quem não pode assumir não descobre se alguém já assumiu. Dirigido a
  -- outra pessoa, ou sem destinatário fora da Recepção, ninguém além do destinatário assume.
  if not public.atendente_elegivel(p_ator, v_setor)
     or (v_atendimento.fila_funcionario_id is not null
         and v_atendimento.fila_funcionario_id <> p_ator)
     or (v_atendimento.fila_funcionario_id is null and v_setor <> 'recepcao') then
    return jsonb_build_object('status', 'inelegivel');
  end if;
  if v_atendimento.funcionario_id is not null then
    return jsonb_build_object('status', 'ja_assumido');
  end if;

  update public.atendimentos
  set funcionario_id = p_ator, fila_funcionario_id = null, fila_desde = null, assumido_em = now()
  where id = p_atendimento_id;
  insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
  values (p_atendimento_id, p_ator);
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (gen_random_uuid(), p_ator, v_setor, 'atendimento.assumir', p_atendimento_id::text, 'sucesso');

  return jsonb_build_object('status', 'assumido');
end;
$$;

CREATE OR REPLACE FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
begin
  select * into v_alvo from public.perfis where id = alvo_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
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

  -- Responsável dos outros Setores (#165): a desativação o remove, com a auditoria de sempre. A marca
  -- impede o gatilho de auditar de novo as mesmas linhas.
  perform set_config('rigoni.removendo_responsavel_por_desativacao', 'on', true);
  with removidos_por_setor as (
    delete from public.cliente_responsaveis
    where responsavel_id = alvo_id
    returning cliente_id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'cliente.remover-responsavel', c.cnpj, 'sucesso', now()
  from removidos_por_setor r
  join public.clientes c on c.id = r.cliente_id;
  perform set_config('rigoni.removendo_responsavel_por_desativacao', 'off', true);

  -- A marca vale só nesta transação: quem protege o dono do Atendimento (aviso de inatividade, #73)
  -- distingue a devolução da Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        -- O Atendimento volta ao destinatário que a regra do Setor aponta agora: o Responsável do
        -- Cliente (o desativado já foi removido acima) ou, sem ele, o Líder ativo. Na Recepção, ou sem
        -- destinatário, fica sem dono nem destinatário.
        fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor),
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

-- #166 (spec #160): o dirigido ao desativado vai à espera dirigida ao Líder ativo do Setor; o resto é a #164.

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

  -- A marca vale só nesta transação: quem protege o dono do Atendimento (aviso de inatividade, #73)
  -- distingue a devolução da Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        -- Dirigido ao desativado vai à espera dirigida ao Líder do Setor (o desativado, se for ele o
        -- Líder, já não conta); sem Líder ativo, cai na espera do Setor.
        fila_funcionario_id = case
          when a.fila_funcionario_id = alvo_id then (
            select p.id from public.perfis p
            where p.setor = a.setor and p.papel = 'lider_setor' and p.desativado_em is null
          )
        end,
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

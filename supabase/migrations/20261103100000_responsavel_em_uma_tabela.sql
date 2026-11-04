-- Responsável do Cliente numa tabela só (ADR 0003 revista): o do Simples Nacional passa de
-- `cliente_cadastro_operacional_sn.responsavel_id` para `cliente_responsaveis`, como o dos demais Setores.
-- Some o ramo "SN ou demais" das funções, dos gatilhos e da regra de acesso. Comportamento igual ao de antes.

-- Dados: o SN entra em cliente_responsaveis. Os gatilhos ficam desligados só nesta cópia (os dados já
-- existiam sob as regras antigas e a cópia não é uma atribuição nova a auditar).
ALTER TABLE public.cliente_responsaveis DROP CONSTRAINT cliente_responsaveis_fora_do_sn;
ALTER TABLE public.cliente_responsaveis DISABLE TRIGGER USER;
INSERT INTO public.cliente_responsaveis (cliente_id, setor, responsavel_id)
SELECT cliente_id, 'simples_nacional', responsavel_id
FROM public.cliente_cadastro_operacional_sn
WHERE responsavel_id IS NOT NULL
ON CONFLICT DO NOTHING;
ALTER TABLE public.cliente_responsaveis ENABLE TRIGGER USER;

DROP TRIGGER cliente_cadastro_operacional_auditar_responsavel ON public.cliente_cadastro_operacional_sn;
DROP TRIGGER cliente_cadastro_operacional_proteger_responsavel ON public.cliente_cadastro_operacional_sn;
DROP TRIGGER cliente_cadastro_operacional_reconciliar_esperas ON public.cliente_cadastro_operacional_sn;
ALTER TABLE public.cliente_cadastro_operacional_sn DROP COLUMN responsavel_id;
DROP FUNCTION public.auditar_responsavel_cliente();
DROP FUNCTION public.proteger_responsavel_cliente();

CREATE OR REPLACE FUNCTION public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
begin
  if novo_papel = 'admin' then
    raise exception 'papel invalido.';
  end if;

  select * into v_alvo from public.perfis where id = alvo_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  if v_alvo.papel = 'admin' or v_alvo.desativado_em is not null then
    raise exception 'alvo nao pode mudar de papel.';
  end if;
  if v_alvo.papel = novo_papel then
    return;
  end if;

  select * into v_ator from public.perfis where id = ator_id;
  if not found then
    raise exception 'ator inexistente.';
  end if;

  if exists (
    select 1 from public.cliente_responsaveis where responsavel_id = alvo_id
  ) then
    raise exception 'responsavel_com_clientes';
  end if;

  begin
    update public.perfis set papel = novo_papel where id = alvo_id;
  exception when unique_violation then
    raise exception 'setor_com_lider';
  end;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), v_ator.id, v_alvo.setor,
    case when novo_papel = 'lider_setor' then 'usuario.promover' else 'usuario.rebaixar' end,
    v_alvo.email, 'sucesso', now()
  );
end;
$$;
CREATE OR REPLACE FUNCTION public.avisar_nova_alteracao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id, alteracao_id, alteracao_numero)
  select d.id, 'nova_alteracao', new.cliente_id, new.id, new.numero
    from (
      select p.id from public.perfis p
       where p.setor = 'simples_nacional' and p.papel = 'lider_setor' and p.desativado_em is null
      union
      select p.id from public.cliente_responsaveis r
        join public.perfis p on p.id = r.responsavel_id
       where r.cliente_id = new.cliente_id and r.setor = 'simples_nacional' and p.desativado_em is null
    ) d
   where exists (select 1 from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id);
  return null;
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

  -- Responsável de todo Setor: a desativação o remove, com a auditoria de sempre. A marca
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

  -- A marca vale só nesta transação: quem protege o dono do Atendimento (aviso de inatividade)
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
CREATE OR REPLACE FUNCTION public.destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select case when p_setor = 'recepcao' then null else coalesce(
    (select p.id
     from public.perfis p
     where p.id = (select r.responsavel_id from public.cliente_responsaveis r
                   where r.cliente_id = p_cliente_id and r.setor = p_setor)
       and p.papel = 'funcionario' and p.setor = p_setor and p.desativado_em is null),
    (select p.id from public.perfis p
     where p.setor = p_setor and p.papel = 'lider_setor' and p.desativado_em is null
     limit 1)
  ) end;
$$;
CREATE OR REPLACE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_table_name = 'cliente_responsaveis' then
    perform public.reconciliar_esperas_sem_destinatario(new.setor, new.cliente_id);
  else
    perform public.reconciliar_esperas_sem_destinatario(new.setor);
  end if;
  return null;
end;
$$;
CREATE OR REPLACE FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_responsaveis
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  );
$$;
-- O Responsável do SN continua legível por quem vê o Cliente (era assim pelo cadastro operacional); o dos
-- demais Setores segue só do Admin, do Líder do Setor e do próprio Responsável.
DROP POLICY cliente_responsaveis_select ON public.cliente_responsaveis;
CREATE POLICY cliente_responsaveis_select ON public.cliente_responsaveis FOR SELECT USING (
  public.acesso_liberado() AND (
    public.meu_papel() = 'admin'
    OR (public.meu_papel() = 'lider_setor' AND public.meu_setor() = setor)
    OR responsavel_id = auth.uid()
    OR (setor = 'simples_nacional' AND public.pode_ver_cliente(cliente_id))
  )
);

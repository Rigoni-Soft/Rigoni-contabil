-- #165: a regra de destino da Transferência (Responsável do Cliente no Setor de destino, ou o
-- Líder) é do sistema, não do Simples Nacional. O SN segue com `responsavel_id` no cadastro
-- operacional; os demais Setores guardam o Responsável aqui, um por Cliente e por Setor.
CREATE TABLE public.cliente_responsaveis (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    setor public.setor_slug NOT NULL,
    responsavel_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    PRIMARY KEY (cliente_id, setor),
    CONSTRAINT cliente_responsaveis_fora_do_sn CHECK (setor <> 'simples_nacional')
);

CREATE INDEX cliente_responsaveis_responsavel_idx ON public.cliente_responsaveis (responsavel_id);

-- Só o Líder do próprio Setor atribui, e só a Funcionário ativo desse Setor (FOR SHARE: uma
-- desativação concorrente espera). Sem auth.uid() (service_role, migrations) o chamador é o servidor.
CREATE FUNCTION public.proteger_cliente_responsavel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null
     and (public.meu_papel() is distinct from 'lider_setor'
          or public.meu_setor() is distinct from new.setor) then
    raise exception 'Só o Líder do Setor atribui o Responsável.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.perfis
    where id = new.responsavel_id
      and papel = 'funcionario'
      and setor = new.setor
      and desativado_em is null
    for share
  ) then
    raise exception 'O Responsável deve ser Funcionário ativo do Setor.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Atribuir, trocar e remover nascem na mesma transação da escrita (como no SN).
CREATE FUNCTION public.auditar_cliente_responsavel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null
     or current_setting('rigoni.removendo_responsavel_por_desativacao', true) = 'on'
     or (tg_op = 'UPDATE' and new.responsavel_id = old.responsavel_id) then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(),
    case tg_op
      when 'DELETE' then 'cliente.remover-responsavel'
      when 'INSERT' then 'cliente.atribuir-responsavel'
      else 'cliente.trocar-responsavel'
    end,
    (select cnpj from public.clientes where id = v_cliente), 'sucesso', now()
  );
  return null;
end;
$$;

CREATE TRIGGER cliente_responsaveis_proteger BEFORE INSERT OR UPDATE ON public.cliente_responsaveis FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_responsavel();

CREATE TRIGGER cliente_responsaveis_auditar AFTER INSERT OR UPDATE OR DELETE ON public.cliente_responsaveis FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_responsavel();

ALTER TABLE public.cliente_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_responsaveis_select ON public.cliente_responsaveis FOR SELECT
  USING (public.acesso_liberado() and (public.meu_papel() = 'admin' or public.meu_setor() = setor));

CREATE POLICY cliente_responsaveis_insert ON public.cliente_responsaveis FOR INSERT
  WITH CHECK (public.acesso_liberado() and public.meu_papel() = 'lider_setor' and public.meu_setor() = setor);

CREATE POLICY cliente_responsaveis_update ON public.cliente_responsaveis FOR UPDATE
  USING (public.acesso_liberado() and public.meu_papel() = 'lider_setor' and public.meu_setor() = setor)
  WITH CHECK (public.acesso_liberado() and public.meu_papel() = 'lider_setor' and public.meu_setor() = setor);

CREATE POLICY cliente_responsaveis_delete ON public.cliente_responsaveis FOR DELETE
  USING (public.acesso_liberado() and public.meu_papel() = 'lider_setor' and public.meu_setor() = setor);

revoke all on table public.cliente_responsaveis from public, anon;
grant select, insert, update, delete on table public.cliente_responsaveis to authenticated;
grant all on table public.cliente_responsaveis to service_role;

revoke all on function public.proteger_cliente_responsavel() from public, anon, authenticated;
revoke all on function public.auditar_cliente_responsavel() from public, anon, authenticated;

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

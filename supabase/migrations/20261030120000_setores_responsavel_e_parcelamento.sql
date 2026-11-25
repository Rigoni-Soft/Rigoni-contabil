update storage.buckets
set file_size_limit = 20971520
where id = 'documentos-clientes';


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

  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor),
        assumido_em = null,
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
DROP POLICY cliente_responsaveis_select ON public.cliente_responsaveis;
CREATE POLICY cliente_responsaveis_select ON public.cliente_responsaveis FOR SELECT USING (
  public.acesso_liberado() AND (
    public.meu_papel() = 'admin'
    OR (public.meu_papel() = 'lider_setor' AND public.meu_setor() = setor)
    OR responsavel_id = auth.uid()
    OR (setor = 'simples_nacional' AND public.pode_ver_cliente(cliente_id))
  )
);

ALTER TABLE public.cliente_parcelamentos ADD COLUMN setor public.setor_slug NOT NULL DEFAULT 'simples_nacional';
ALTER TABLE public.cliente_parcelamentos ALTER COLUMN setor DROP DEFAULT;
CREATE INDEX cliente_parcelamentos_setor_idx ON public.cliente_parcelamentos USING btree (cliente_id, setor);

CREATE FUNCTION public.sou_responsavel_do_cliente_no_setor(p_cliente_id uuid, p_setor public.setor_slug) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_responsaveis
    where cliente_id = p_cliente_id and setor = p_setor and responsavel_id = auth.uid()
  );
$$;

CREATE FUNCTION public.pode_gerir_parcelamento(p_cliente_id uuid, p_setor public.setor_slug) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and coalesce(case public.meu_papel()
    when 'admin' then true
    when 'lider_setor' then public.meu_setor() = p_setor
    when 'funcionario' then
      public.meu_setor() = p_setor and public.sou_responsavel_do_cliente_no_setor(p_cliente_id, p_setor)
    else false
  end, false);
$$;

REVOKE ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) TO authenticated;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) TO service_role;
REVOKE ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) TO authenticated;
GRANT ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) TO service_role;

DROP POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos;
CREATE POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos FOR SELECT USING (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos FOR INSERT WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos FOR UPDATE USING (public.pode_gerir_parcelamento(cliente_id, setor)) WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos FOR DELETE USING (public.pode_gerir_parcelamento(cliente_id, setor));

DROP POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias;
DROP POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias;
DROP POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias;
CREATE POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));
CREATE POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));
CREATE POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));

DROP FUNCTION public.salvar_parcelamentos_cliente(uuid, jsonb);
CREATE FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_setor public.setor_slug, p_itens jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.cliente_parcelamentos
   where cliente_id = p_cliente_id and setor = p_setor
     and id not in (select (item ->> 'id')::uuid from jsonb_array_elements(p_itens) as item);

  update public.cliente_parcelamentos p
     set codigo = item ->> 'codigo',
         parcelas_restantes = (item ->> 'parcelasRestantes')::integer,
         interno = (item ->> 'interno')::boolean
    from jsonb_array_elements(p_itens) as item
   where p.cliente_id = p_cliente_id and p.setor = p_setor and p.id = (item ->> 'id')::uuid;

  insert into public.cliente_parcelamentos (
    id, cliente_id, setor, codigo, parcelas_restantes, interno, arquivo_caminho,
    origem, total_parcelas, valor_parcela_centavos, data_adesao, criado_em
  )
  select (item ->> 'id')::uuid, p_cliente_id, p_setor, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho',
         item #>> '{acordo,origem}', (item #>> '{acordo,totalDeParcelas}')::integer,
         (item #>> '{acordo,valorDaParcelaCentavos}')::integer, (item #>> '{acordo,dataDeAdesao}')::date,
         now() + ordem * interval '1 microsecond'
    from jsonb_array_elements(p_itens) with ordinality as it(item, ordem)
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) TO service_role;

CREATE FUNCTION public.proteger_cliente_parcelamento_regime() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
  v_setor public.setor_slug := case when tg_op = 'DELETE' then old.setor else new.setor end;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.setor is distinct from old.setor then
    raise exception 'O Setor do Parcelamento não pode ser trocado.' using errcode = '23514';
  end if;
  if v_setor = 'simples_nacional' and not exists (
    select 1 from public.clientes
    where id = v_cliente_id and regime in ('simples_nacional', 'mei')
  ) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_regime() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_regime() TO service_role;

DROP TRIGGER cliente_parcelamentos_proteger ON public.cliente_parcelamentos;
CREATE TRIGGER cliente_parcelamentos_proteger BEFORE INSERT OR DELETE OR UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_regime();

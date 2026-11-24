
ALTER TABLE public.atendimento_sessoes DROP CONSTRAINT atendimento_sessoes_etapa_check;
ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_etapa_check
    CHECK (etapa = ANY (ARRAY['tipo_documento'::text, 'alteracao'::text, 'ja_cliente'::text, 'cnpj'::text, 'cnpj_nova_tentativa'::text, 'setor'::text]));

ALTER TABLE public.atendimento_sessoes DROP CONSTRAINT atendimento_sessoes_check;
ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_check
    CHECK (((etapa = 'alteracao'::text) = (modo IS NOT NULL)) AND ((etapa = 'alteracao'::text) = (lista IS NOT NULL)));

ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_pagina_etapa_check
    CHECK ((etapa = ANY (ARRAY['alteracao'::text, 'setor'::text])) = (pagina IS NOT NULL));


CREATE FUNCTION public.chave_telefone(p_telefone text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case
    when d = '' then null
    when length(d) > 11 and left(d, 2) = '55' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') as d) x;
$$;
REVOKE ALL ON FUNCTION public.chave_telefone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chave_telefone(text) TO authenticated, service_role;

CREATE TABLE public.setores_de_contato (
    slug text NOT NULL,
    rotulo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT setores_de_contato_pkey PRIMARY KEY (slug),
    CONSTRAINT setores_de_contato_slug_check CHECK (btrim(slug) <> ''),
    CONSTRAINT setores_de_contato_rotulo_check CHECK (btrim(rotulo) <> '')
);
INSERT INTO public.setores_de_contato (slug, rotulo) VALUES
    ('ura', 'URA'),
    ('simples_nacional', 'Simples Nacional'),
    ('rh', 'RH'),
    ('tributario', 'Tributário'),
    ('contabil', 'Contábil'),
    ('societario', 'Societário'),
    ('condominios', 'Condomínios'),
    ('financeiro', 'Financeiro'),
    ('administrativo', 'Administrativo'),
    ('recepcao', 'Recepção');
ALTER TABLE public.setores_de_contato ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.setores_de_contato FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.setores_de_contato TO authenticated;
GRANT ALL ON TABLE public.setores_de_contato TO service_role;
CREATE POLICY setores_de_contato_select ON public.setores_de_contato
    FOR SELECT TO authenticated USING (true);

ALTER TABLE public.cliente_contatos
    ALTER COLUMN telefone DROP NOT NULL,
    ADD COLUMN email text,
    ADD COLUMN dono_setor public.setor_slug;

UPDATE public.cliente_contatos SET telefone = NULL WHERE public.chave_telefone(telefone) IS NULL;

DO $$
declare
  v_lista text;
begin
  select string_agg(format('%s (Cliente %s)', nome, cliente_id), '; ') into v_lista
  from public.cliente_contatos where telefone is null;
  if v_lista is not null then
    raise exception 'Contatos sem WhatsApp válido e sem e-mail; corrija ou remova antes de aplicar: %', v_lista;
  end if;
END $$;

UPDATE public.cliente_contatos ct
   SET dono_setor = CASE WHEN c.regime IN ('simples_nacional', 'mei')
                         THEN 'simples_nacional'::public.setor_slug ELSE 'rh'::public.setor_slug END
  FROM public.clientes c
 WHERE c.id = ct.cliente_id;

DROP INDEX public.cliente_contatos_um_padrao_por_cliente;
ALTER TABLE public.cliente_contatos DROP COLUMN padrao;

ALTER TABLE public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_nome_check CHECK (btrim(nome) <> ''),
    ADD CONSTRAINT cliente_contatos_email_check CHECK (email IS NULL OR (btrim(email) <> '' AND email = lower(btrim(email)))),
    ADD CONSTRAINT cliente_contatos_canal_check
        CHECK (public.chave_telefone(telefone) IS NOT NULL OR email IS NOT NULL);

CREATE TABLE public.cliente_contato_setores (
    contato_id uuid NOT NULL REFERENCES public.cliente_contatos(id) ON DELETE CASCADE,
    setor text NOT NULL REFERENCES public.setores_de_contato(slug),
    CONSTRAINT cliente_contato_setores_pkey PRIMARY KEY (contato_id, setor)
);
ALTER TABLE public.cliente_contato_setores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cliente_contato_setores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cliente_contato_setores TO authenticated;
GRANT ALL ON TABLE public.cliente_contato_setores TO service_role;
CREATE POLICY cliente_contato_setores_select ON public.cliente_contato_setores
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.cliente_contatos c WHERE c.id = contato_id));

INSERT INTO public.cliente_contato_setores (contato_id, setor)
SELECT id, 'ura' FROM public.cliente_contatos;

ALTER TABLE public.cliente_contatos DISABLE TRIGGER USER;
WITH ranqueados AS (
    SELECT id, dono_setor,
           first_value(id) OVER w AS manter_id,
           row_number() OVER w AS posicao
    FROM public.cliente_contatos
    WHERE public.chave_telefone(telefone) IS NOT NULL
    WINDOW w AS (PARTITION BY cliente_id, public.chave_telefone(telefone) ORDER BY criado_em, id)
), repetidos AS (
    SELECT * FROM ranqueados WHERE posicao > 1
), somados AS (
    INSERT INTO public.cliente_contato_setores (contato_id, setor)
    SELECT DISTINCT manter_id, dono_setor::text FROM repetidos WHERE dono_setor IS NOT NULL
    ON CONFLICT DO NOTHING
)
DELETE FROM public.cliente_contatos WHERE id IN (SELECT id FROM repetidos);
ALTER TABLE public.cliente_contatos ENABLE TRIGGER USER;

CREATE UNIQUE INDEX cliente_contatos_telefone_unico_no_cliente
    ON public.cliente_contatos (cliente_id, public.chave_telefone(telefone))
    WHERE public.chave_telefone(telefone) IS NOT NULL;
CREATE UNIQUE INDEX cliente_contatos_email_unico_no_cliente
    ON public.cliente_contatos (cliente_id, email)
    WHERE email IS NOT NULL;

CREATE FUNCTION public.contato_vincular_setores_ao_criar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.cliente_contato_setores (contato_id, setor)
  values (new.id, 'ura')
  on conflict do nothing;
  if new.dono_setor is not null then
    insert into public.cliente_contato_setores (contato_id, setor)
    values (new.id, new.dono_setor::text)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_vincular_setores_ao_criar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_vincular_setores_ao_criar() TO service_role;
CREATE TRIGGER cliente_contatos_vincular_setores AFTER INSERT ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.contato_vincular_setores_ao_criar();

CREATE FUNCTION public.contato_validar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_existente public.cliente_contatos;
begin
  if tg_op = 'UPDATE' then
    if new.cliente_id is distinct from old.cliente_id then
      raise exception 'O Cliente do contato não pode ser trocado.' using errcode = '23514';
    end if;
    if new.dono_setor is distinct from old.dono_setor
       and not (new.dono_setor is null and current_setting('app.contato_herdado_pela_ura', true) = old.id::text) then
      raise exception 'O Setor dono do contato não pode ser trocado.' using errcode = '23514';
    end if;
  end if;
  new.nome := btrim(new.nome);
  new.telefone := nullif(btrim(coalesce(new.telefone, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');

  if new.telefone is not null
     and (tg_op = 'INSERT' or new.telefone is distinct from old.telefone)
     and length(coalesce(public.chave_telefone(new.telefone), '')) not in (10, 11) then
    raise exception 'O WhatsApp precisa do DDD e do número (10 ou 11 dígitos).' using errcode = '22023';
  end if;

  select * into v_existente
  from public.cliente_contatos x
  where x.cliente_id = new.cliente_id
    and x.id <> new.id
    and ((public.chave_telefone(new.telefone) is not null
          and public.chave_telefone(x.telefone) = public.chave_telefone(new.telefone))
         or (new.email is not null and x.email = new.email))
  limit 1;
  if found then
    raise exception 'Este Cliente já tem o contato "%" com o mesmo WhatsApp ou e-mail.', v_existente.nome
      using errcode = '23505', hint = v_existente.id::text;
  end if;
  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_validar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_validar() TO service_role;
CREATE TRIGGER cliente_contatos_validar BEFORE INSERT OR UPDATE ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.contato_validar();

DROP TRIGGER cliente_contatos_proteger ON public.cliente_contatos;
DROP TRIGGER cliente_contatos_auditar ON public.cliente_contatos;
CREATE TRIGGER cliente_contatos_auditar AFTER INSERT OR UPDATE OR DELETE ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE FUNCTION public.pode_gerir_contato(p_cliente_id uuid, p_dono public.setor_slug) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and case
    when public.meu_papel() = 'admin' then true
    when p_dono is null then false
    else public.pode_gerir_parcelamento(p_cliente_id, p_dono)
  end;
$$;
REVOKE ALL ON FUNCTION public.pode_gerir_contato(uuid, public.setor_slug) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_gerir_contato(uuid, public.setor_slug) TO authenticated, service_role;

CREATE FUNCTION public.dono_do_novo_contato() RETURNS public.setor_slug
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when public.meu_papel() = 'admin' then null else public.meu_setor() end;
$$;
REVOKE ALL ON FUNCTION public.dono_do_novo_contato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dono_do_novo_contato() TO authenticated, service_role;

DROP POLICY cliente_contatos_insert_sn ON public.cliente_contatos;
DROP POLICY cliente_contatos_delete_sn ON public.cliente_contatos;
CREATE POLICY cliente_contatos_insert ON public.cliente_contatos FOR INSERT TO authenticated
    WITH CHECK (public.pode_gerir_contato(cliente_id, dono_setor)
                AND dono_setor IS NOT DISTINCT FROM public.dono_do_novo_contato());
CREATE POLICY cliente_contatos_update ON public.cliente_contatos FOR UPDATE TO authenticated
    USING (public.pode_gerir_contato(cliente_id, dono_setor))
    WITH CHECK (public.pode_gerir_contato(cliente_id, dono_setor));
CREATE POLICY cliente_contatos_delete ON public.cliente_contatos FOR DELETE TO authenticated
    USING (public.pode_gerir_contato(cliente_id, dono_setor));

CREATE FUNCTION public.contato_id_do_item(p_item jsonb) RETURNS uuid
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
begin
  if jsonb_typeof(p_item) <> 'object' then
    raise exception 'O contato deve ser um objeto.' using errcode = '22023';
  end if;
  if nullif(p_item ->> 'id', '') is null then
    return null;
  end if;
  if (p_item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'O id do contato é inválido.' using errcode = '22023';
  end if;
  return (p_item ->> 'id')::uuid;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_id_do_item(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_id_do_item(jsonb) TO authenticated, service_role;

CREATE FUNCTION public.contato_gravar(p_cliente_id uuid, p_item jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid := coalesce(public.contato_id_do_item(p_item), gen_random_uuid());
  v_nome text := btrim(coalesce(p_item ->> 'nome', ''));
  v_telefone text := nullif(btrim(coalesce(p_item ->> 'telefone', '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_item ->> 'email', ''))), '');
  v_atual public.cliente_contatos;
  v_dono public.setor_slug := public.dono_do_novo_contato();
begin
  select * into v_atual from public.cliente_contatos where id = v_id;
  if found then
    if v_atual.cliente_id <> p_cliente_id then
      raise exception 'O contato pertence a outro Cliente.' using errcode = '42501';
    end if;
    if v_atual.nome is distinct from v_nome
       or public.chave_telefone(v_atual.telefone) is distinct from public.chave_telefone(v_telefone)
       or v_atual.email is distinct from v_email then
      if not public.pode_gerir_contato(p_cliente_id, v_atual.dono_setor) then
        raise exception 'Só o Setor dono do contato "%" ou o Admin pode editá-lo.', v_atual.nome
          using errcode = '42501';
      end if;
      update public.cliente_contatos
         set nome = v_nome, telefone = v_telefone, email = v_email
       where id = v_id;
    end if;
  else
    if not public.pode_gerir_contato(p_cliente_id, v_dono) then
      raise exception 'Sem permissão para cadastrar contatos neste Cliente.' using errcode = '42501';
    end if;
    insert into public.cliente_contatos (id, cliente_id, nome, telefone, email, dono_setor)
    values (v_id, p_cliente_id, v_nome, v_telefone, v_email, v_dono);
  end if;
  return v_id;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_gravar(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_gravar(uuid, jsonb) TO authenticated, service_role;

CREATE FUNCTION public.salvar_contatos_do_cliente(p_cliente_id uuid, p_contatos jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_item jsonb;
  v_id uuid;
  v_remover public.cliente_contatos;
  v_ids uuid[] := '{}';
begin
  if p_contatos is null or jsonb_typeof(p_contatos) <> 'array' then
    raise exception 'Os contatos devem ser uma lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_contatos) > 50 then
    raise exception 'O cadastro aceita no máximo 50 contatos.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_contatos) loop
    v_id := public.contato_id_do_item(v_item);
    if v_id is not null then
      v_ids := v_ids || v_id;
    end if;
  end loop;

  for v_remover in
    select * from public.cliente_contatos
    where cliente_id = p_cliente_id and id <> all (v_ids)
  loop
    if not public.pode_gerir_contato(p_cliente_id, v_remover.dono_setor) then
      raise exception 'Só o Setor dono do contato "%" ou o Admin pode removê-lo.', v_remover.nome
        using errcode = '42501';
    end if;
    delete from public.cliente_contatos where id = v_remover.id;
  end loop;

  for v_item in select * from jsonb_array_elements(p_contatos) loop
    perform public.contato_gravar(p_cliente_id, v_item);
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_contatos_do_cliente(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_contatos_do_cliente(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.acesso_liberado() and not public.regime_tem_cadastro_operacional_sn(p_cliente_id) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  if p_ano_mes is distinct from public.mes_corrente_sp() then
    raise exception 'Só a Atividade do mês corrente é editável.' using errcode = '23514';
  end if;

  insert into public.cliente_cadastro_operacional_sn
    (cliente_id, forma_envio, documento_obrigatorio, das_status, data_envio_das,
     observacoes_gerais, atualizado_em)
  values
    (p_cliente_id, p_forma_envio, p_documento_obrigatorio, p_das_status, p_data_envio_das,
     p_observacoes_gerais, now())
  on conflict (cliente_id) do update set
    forma_envio = excluded.forma_envio,
    documento_obrigatorio = excluded.documento_obrigatorio,
    das_status = excluded.das_status,
    data_envio_das = excluded.data_envio_das,
    observacoes_gerais = excluded.observacoes_gerais,
    atualizado_em = now();

  perform public.salvar_contatos_do_cliente(p_cliente_id, p_contatos);

  insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
  values (gen_random_uuid(), p_cliente_id, p_ano_mes, p_industria, p_comercio, p_servico)
  on conflict (cliente_id, ano_mes) do update set
    industria = excluded.industria,
    comercio = excluded.comercio,
    servico = excluded.servico;
end;
$$;

CREATE FUNCTION public.editar_cadastro_rh_cliente(p_cliente_id uuid, p_observacoes text, p_contatos jsonb DEFAULT NULL) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.pode_gerir_parcelamento(p_cliente_id, 'rh') then
    raise exception 'Sem permissão para editar o cadastro do RH.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_observacoes, '')) > 2000 then
    raise exception 'As observações aceitam no máximo 2000 caracteres.' using errcode = '22023';
  end if;

  insert into public.cliente_observacoes_setor (cliente_id, setor, observacoes, atualizado_em)
  values (p_cliente_id, 'rh', coalesce(p_observacoes, ''), now())
  on conflict (cliente_id, setor) do update set
    observacoes = excluded.observacoes,
    atualizado_em = now();

  if p_contatos is not null then
    perform public.salvar_contatos_do_cliente(p_cliente_id, p_contatos);
  end if;

  if current_setting('app.cliente_auditado', true) is distinct from p_cliente_id::text then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.editar-operacional',
      (select cnpj from public.clientes where id = p_cliente_id), 'sucesso', now()
    );
  end if;
end;
$$;

REVOKE ALL ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) TO authenticated, service_role;

CREATE FUNCTION public.contato_por_telefone_no_cliente(p_cliente_id uuid, p_telefone text) RETURNS TABLE(id uuid, nome text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select ct.id, ct.nome
  from public.cliente_contatos ct
  where ct.cliente_id = p_cliente_id
    and public.chave_telefone(p_telefone) is not null
    and public.chave_telefone(ct.telefone) = public.chave_telefone(p_telefone)
  order by ct.criado_em, ct.id
  limit 1;
$$;
REVOKE ALL ON FUNCTION public.contato_por_telefone_no_cliente(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_por_telefone_no_cliente(uuid, text) TO authenticated, service_role;

DROP FUNCTION public.identificar_contato_por_telefone(text);
CREATE FUNCTION public.identificar_contato_por_telefone(p_telefone text) RETURNS TABLE(cliente_id uuid, nome text, empresa text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select distinct on (c.id) c.id, ct.nome, c.empresa
  from public.cliente_contatos ct
  join public.clientes c on c.id = ct.cliente_id
  where public.chave_telefone(p_telefone) is not null
    and public.chave_telefone(ct.telefone) = public.chave_telefone(p_telefone)
  order by c.id, ct.criado_em, ct.id;
$$;
REVOKE ALL ON FUNCTION public.identificar_contato_por_telefone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identificar_contato_por_telefone(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fila_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, fila_funcionario_id uuid, fila_desde timestamp with time zone, telefone text, contato_nome text, empresa text, cnpj text, resumo text, origem_setor public.setor_slug, origem_nome text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    a.id, a.fila_funcionario_id, a.fila_desde, a.telefone,
    (select f.nome from public.contato_por_telefone_no_cliente(a.cliente_id, a.chave_telefone) f),
    c.empresa, c.cnpj,
    coalesce(t.resumo, a.resumo_ura),
    t.setor_origem,
    p.nome
  from public.atendimentos a
  left join public.clientes c on c.id = a.cliente_id
  left join lateral (
    select x.resumo, x.setor_origem, x.funcionario_origem_id
    from public.transferencias x
    where x.atendimento_id = a.id order by x.criado_em desc, x.id desc limit 1
  ) t on true
  left join public.perfis p on p.id = t.funcionario_origem_id
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
  order by a.fila_desde, a.id;
$$;

CREATE OR REPLACE FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atendimento public.atendimentos;
  v_contato_nome text;
  v_empresa text;
  v_cnpj text;
begin
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
    select f.nome into v_contato_nome
    from public.contato_por_telefone_no_cliente(v_atendimento.cliente_id, v_atendimento.chave_telefone) f;
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



CREATE TABLE public.tipos_de_envio (
    slug text NOT NULL,
    rotulo text NOT NULL,
    CONSTRAINT tipos_de_envio_pkey PRIMARY KEY (slug),
    CONSTRAINT tipos_de_envio_rotulo_check CHECK (btrim(rotulo) <> '')
);
INSERT INTO public.tipos_de_envio (slug, rotulo) VALUES
    ('lembrete_documento', 'Lembrete de documento'),
    ('das', 'DAS'),
    ('guia_parcelamento', 'Guia de parcelamento'),
    ('avisos', 'Avisos');

CREATE TABLE public.tipos_de_envio_do_setor (
    setor public.setor_slug NOT NULL,
    tipo text NOT NULL REFERENCES public.tipos_de_envio(slug),
    CONSTRAINT tipos_de_envio_do_setor_pkey PRIMARY KEY (setor, tipo)
);
INSERT INTO public.tipos_de_envio_do_setor (setor, tipo) VALUES
    ('simples_nacional', 'lembrete_documento'),
    ('simples_nacional', 'das'),
    ('simples_nacional', 'guia_parcelamento'),
    ('simples_nacional', 'avisos'),
    ('rh', 'guia_parcelamento'),
    ('rh', 'avisos');

ALTER TABLE public.tipos_de_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_de_envio_do_setor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor TO authenticated;
GRANT ALL ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor TO service_role;
CREATE POLICY tipos_de_envio_select ON public.tipos_de_envio FOR SELECT TO authenticated USING (true);
CREATE POLICY tipos_de_envio_do_setor_select ON public.tipos_de_envio_do_setor FOR SELECT TO authenticated USING (true);

ALTER TABLE public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_id_cliente_unico UNIQUE (id, cliente_id);

CREATE TABLE public.destinos_de_envio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    setor public.setor_slug NOT NULL,
    tipo text,
    contato_id uuid NOT NULL,
    canal public.forma_envio NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT destinos_de_envio_pkey PRIMARY KEY (id),
    CONSTRAINT destinos_de_envio_contato_fkey FOREIGN KEY (contato_id, cliente_id)
        REFERENCES public.cliente_contatos(id, cliente_id) ON DELETE CASCADE,
    CONSTRAINT destinos_de_envio_tipo_fkey FOREIGN KEY (setor, tipo)
        REFERENCES public.tipos_de_envio_do_setor(setor, tipo)
);
CREATE UNIQUE INDEX destinos_de_envio_unico
    ON public.destinos_de_envio (cliente_id, setor, COALESCE(tipo, ''), contato_id);
CREATE INDEX destinos_de_envio_contato_idx ON public.destinos_de_envio (contato_id);

CREATE FUNCTION public.destino_validar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_contato public.cliente_contatos;
begin
  select * into v_contato from public.cliente_contatos
  where id = new.contato_id and cliente_id = new.cliente_id;
  if not found then
    raise exception 'O contato do destino não pertence a este Cliente.' using errcode = '23503';
  end if;
  if new.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(v_contato.telefone) is null then
    raise exception 'O contato "%" não tem WhatsApp.', v_contato.nome using errcode = '23514';
  end if;
  if new.canal in ('email', 'whatsapp_e_email') and v_contato.email is null then
    raise exception 'O contato "%" não tem e-mail.', v_contato.nome using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.cliente_id is distinct from old.cliente_id
                           or new.setor is distinct from old.setor
                           or new.contato_id is distinct from old.contato_id) then
    raise exception 'O Cliente, o Setor e o contato do destino não podem ser trocados.' using errcode = '23514';
  end if;
  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.destino_validar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destino_validar() TO service_role;
CREATE TRIGGER destinos_de_envio_validar BEFORE INSERT OR UPDATE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.destino_validar();

CREATE FUNCTION public.destino_sincronizar_setores_do_contato() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.cliente_contato_setores (contato_id, setor)
    values (new.contato_id, new.setor::text)
    on conflict do nothing;
  else
    delete from public.cliente_contato_setores v
    where v.contato_id = old.contato_id and v.setor = old.setor::text
      and not exists (select 1 from public.destinos_de_envio d
                      where d.contato_id = old.contato_id and d.setor = old.setor)
      and not exists (select 1 from public.cliente_contatos c
                      where c.id = old.contato_id and c.dono_setor = old.setor);
  end if;
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.destino_sincronizar_setores_do_contato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destino_sincronizar_setores_do_contato() TO service_role;
CREATE TRIGGER destinos_de_envio_sincronizar_setores AFTER INSERT OR DELETE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.destino_sincronizar_setores_do_contato();

CREATE FUNCTION public.contato_exclusao_em_uso() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_setores text;
begin
  if not exists (select 1 from public.clientes where id = old.cliente_id) then
    return old;
  end if;
  select string_agg(distinct s.rotulo, ', ' order by s.rotulo) into v_setores
  from public.destinos_de_envio d
  join public.setores_de_contato s on s.slug = d.setor::text
  where d.contato_id = old.id and d.setor is distinct from old.dono_setor;
  if v_setores is null then
    return old;
  end if;
  if old.dono_setor is null then
    raise exception 'O contato "%" está em uso por: %.', old.nome, v_setores using errcode = '23503';
  end if;
  perform set_config('app.contato_herdado_pela_ura', old.id::text, true);
  update public.cliente_contatos set dono_setor = null where id = old.id;
  perform set_config('app.contato_herdado_pela_ura', '', true);
  delete from public.destinos_de_envio where contato_id = old.id and setor = old.dono_setor;
  delete from public.cliente_contato_setores where contato_id = old.id and setor = old.dono_setor::text;
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_exclusao_em_uso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_exclusao_em_uso() TO service_role;
CREATE TRIGGER cliente_contatos_exclusao_em_uso BEFORE DELETE ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.contato_exclusao_em_uso();

ALTER TABLE public.destinos_de_envio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.destinos_de_envio FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.destinos_de_envio TO authenticated;
GRANT ALL ON TABLE public.destinos_de_envio TO service_role;

CREATE POLICY destinos_de_envio_select ON public.destinos_de_envio FOR SELECT TO authenticated
    USING (public.meu_papel() = 'admin'
           OR (public.pode_ver_cliente(cliente_id) AND public.meu_setor() = setor));
CREATE POLICY destinos_de_envio_insert ON public.destinos_de_envio FOR INSERT TO authenticated
    WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY destinos_de_envio_update ON public.destinos_de_envio FOR UPDATE TO authenticated
    USING (public.pode_gerir_parcelamento(cliente_id, setor))
    WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY destinos_de_envio_delete ON public.destinos_de_envio FOR DELETE TO authenticated
    USING (public.pode_gerir_parcelamento(cliente_id, setor));

CREATE TRIGGER destinos_de_envio_auditar AFTER INSERT OR UPDATE OR DELETE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE FUNCTION public.destinos_de_envio_resolvidos(p_cliente_id uuid, p_setor public.setor_slug, p_tipo text, p_canal text DEFAULT NULL)
    RETURNS TABLE(destino_id uuid, tipo text, contato_id uuid, contato_nome text, canal public.forma_envio,
                  telefone_envio text, email text, valido boolean, motivo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with candidatos as (
    select d.*, c.nome, c.telefone, c.email as contato_email
    from public.destinos_de_envio d
    join public.cliente_contatos c on c.id = d.contato_id
    where d.cliente_id = p_cliente_id and d.setor = p_setor
  ),
  escolhidos as (
    select * from candidatos where tipo = p_tipo
    union all
    select * from candidatos
    where tipo is null and not exists (select 1 from candidatos where tipo = p_tipo)
  )
  select e.id, e.tipo, e.contato_id, e.nome, e.canal,
         case when length(public.chave_telefone(e.telefone)) in (10, 11)
              then '55' || public.chave_telefone(e.telefone)
              else public.chave_telefone(e.telefone) end,
         e.contato_email,
         not (e.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(e.telefone) is null)
           and not (e.canal in ('email', 'whatsapp_e_email') and e.contato_email is null),
         case when e.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(e.telefone) is null
              then 'sem_whatsapp'
              when e.canal in ('email', 'whatsapp_e_email') and e.contato_email is null
              then 'sem_email' end
  from escolhidos e
  where p_canal is null
     or e.canal = p_canal::public.forma_envio
     or e.canal = 'whatsapp_e_email'
  order by e.criado_em, e.id;
$$;
REVOKE ALL ON FUNCTION public.destinos_de_envio_resolvidos(uuid, public.setor_slug, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destinos_de_envio_resolvidos(uuid, public.setor_slug, text, text) TO authenticated, service_role;

CREATE FUNCTION public.salvar_contato_do_cliente(p_cliente_id uuid, p_contato jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if p_contato is null or jsonb_typeof(p_contato) <> 'object' then
    raise exception 'O contato deve ser um objeto.' using errcode = '22023';
  end if;
  return public.contato_gravar(p_cliente_id, p_contato);
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) TO authenticated, service_role;


CREATE FUNCTION public.definir_tipos_de_envio_do_contato(
    p_cliente_id uuid,
    p_contato_id uuid,
    p_tipos text[],
    p_canal public.forma_envio DEFAULT NULL
)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug := public.meu_setor();
  v_contato public.cliente_contatos;
  v_tem_whatsapp boolean;
  v_tem_email boolean;
  v_canal public.forma_envio;
  v_tipos text[];
begin
  if v_setor is null or public.meu_papel() = 'admin' then
    raise exception 'Só um Setor define os Destinos de envio do Cliente.' using errcode = '42501';
  end if;
  if not public.pode_gerir_parcelamento(p_cliente_id, v_setor) then
    raise exception 'Sem permissão para definir os Destinos de envio deste Cliente.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('definir_tipos_de_envio_do_contato:' || p_contato_id::text));

  select * into v_contato from public.cliente_contatos
  where id = p_contato_id and cliente_id = p_cliente_id;
  if not found then
    raise exception 'O contato não pertence a este Cliente.' using errcode = '22023';
  end if;

  v_tem_whatsapp := public.chave_telefone(v_contato.telefone) is not null;
  v_tem_email := v_contato.email is not null;
  v_tipos := array(select distinct t from unnest(coalesce(p_tipos, '{}')) as t where t is not null);
  if cardinality(v_tipos) > 12 then
    raise exception 'Tipos de envio demais para um contato.' using errcode = '22023';
  end if;

  if v_tem_whatsapp and v_tem_email then
    if p_canal is null then
      if cardinality(v_tipos) > 0 then
        raise exception 'Escolha o canal do envio.' using errcode = '22023';
      end if;
      v_canal := 'whatsapp_e_email';
    else
      v_canal := p_canal;
    end if;
  elsif v_tem_whatsapp then
    v_canal := 'whatsapp';
  else
    v_canal := 'email';
  end if;

  delete from public.destinos_de_envio
  where cliente_id = p_cliente_id and setor = v_setor and contato_id = p_contato_id
    and coalesce(tipo, 'todos') <> all (v_tipos);

  update public.destinos_de_envio set canal = v_canal
  where cliente_id = p_cliente_id and setor = v_setor and contato_id = p_contato_id
    and canal is distinct from v_canal;

  insert into public.destinos_de_envio (cliente_id, setor, tipo, contato_id, canal)
  select p_cliente_id, v_setor, nullif(t, 'todos'), p_contato_id, v_canal
  from unnest(v_tipos) as t
  where not exists (
    select 1 from public.destinos_de_envio d
    where d.cliente_id = p_cliente_id and d.setor = v_setor and d.contato_id = p_contato_id
      and coalesce(d.tipo, 'todos') = t
  )
  group by t;
end;
$$;
REVOKE ALL ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[], public.forma_envio)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[], public.forma_envio)
    TO authenticated, service_role;


DROP FUNCTION public.clientes_para_lembrete(uuid, integer);
DROP FUNCTION public.clientes_para_parcelamento(uuid, integer);
DROP FUNCTION public.clientes_para_envio_base();

CREATE FUNCTION public.clientes_para_envio_base() RETURNS TABLE(cliente_id uuid, empresa text, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.id, c.empresa, o.documento_obrigatorio, o.das_status, o.data_envio_das
  from public.cliente_cadastro_operacional_sn o
  join public.clientes c on c.id = o.cliente_id;
$$;

CREATE FUNCTION public.clientes_para_lembrete(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.*
    from public.clientes_para_envio_base() b
   where p_apos is null or b.cliente_id > p_apos
   order by b.cliente_id
   limit p_limite;
$$;

CREATE FUNCTION public.clientes_para_parcelamento(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.cliente_id, b.empresa
    from public.clientes_para_envio_base() b
   where public.cliente_tem_parcelamento_pendente(b.cliente_id)
     and (p_apos is null or b.cliente_id > p_apos)
   order by b.cliente_id
   limit p_limite;
$$;

REVOKE ALL ON FUNCTION public.clientes_para_envio_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.clientes_para_envio_base() TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) TO service_role;

CREATE FUNCTION public.destinos_de_envio_do_job(p_cliente_id uuid, p_setor public.setor_slug, p_tipo text)
    RETURNS TABLE(contato_nome text, telefone_envio text, email text, canal public.forma_envio,
                  ultima_mensagem_do_contato_em timestamp with time zone, valido boolean, motivo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select r.contato_nome, r.telefone_envio, r.email, r.canal,
         (select max(m.criado_em)
            from public.mensagens m
            join public.atendimentos a on a.id = m.atendimento_id
           where a.chave_telefone = public.chave_telefone(r.telefone_envio) and m.autor = 'contato'),
         r.valido, r.motivo
    from public.destinos_de_envio_resolvidos(p_cliente_id, p_setor, p_tipo) r;
$$;
REVOKE ALL ON FUNCTION public.destinos_de_envio_do_job(uuid, public.setor_slug, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.destinos_de_envio_do_job(uuid, public.setor_slug, text) TO service_role;

CREATE INDEX atendimentos_chave_telefone ON public.atendimentos USING btree (chave_telefone);

ALTER TABLE public.avisos_cadastro ADD COLUMN mensagem text;

CREATE FUNCTION public.avisar_sem_meio_de_envio(p_cliente_id uuid, p_setor public.setor_slug, p_mensagem text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id, mensagem)
  select d.id, 'sem_meio_de_envio', p_cliente_id, p_mensagem
    from (
      select p.id from public.perfis p
       where p.setor = p_setor and p.papel = 'lider_setor' and p.desativado_em is null
      union
      select p.id from public.cliente_responsaveis r
        join public.perfis p on p.id = r.responsavel_id
       where r.cliente_id = p_cliente_id and r.setor = p_setor and p.desativado_em is null
    ) d;
$$;
REVOKE ALL ON FUNCTION public.avisar_sem_meio_de_envio(uuid, public.setor_slug, text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.avisar_sem_meio_de_envio(uuid, public.setor_slug, text) TO service_role;

CREATE FUNCTION public.avisar_cliente_sem_meio_de_envio() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.avisar_sem_meio_de_envio(new.cliente_id, new.setor, new.mensagem);
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.avisar_cliente_sem_meio_de_envio() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.avisar_cliente_sem_meio_de_envio() TO service_role;
CREATE TRIGGER alertas_setor_avisar_sem_meio_de_envio AFTER INSERT ON public.alertas_setor
    FOR EACH ROW WHEN (new.tipo = 'contato_ausente') EXECUTE FUNCTION public.avisar_cliente_sem_meio_de_envio();

SELECT public.avisar_sem_meio_de_envio(a.cliente_id, a.setor, a.mensagem)
  FROM public.alertas_setor a
 WHERE a.tipo = 'contato_ausente' AND a.resolvido_em IS NULL;

CREATE FUNCTION public.cadastrar_contato_ura(p_atendimento_id uuid, p_cliente_id uuid, p_nome text, p_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_atendimento public.atendimentos;
  v_cnpj text;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_chave text;
  v_existente public.cliente_contatos;
  v_id uuid := gen_random_uuid();
begin
  if not public.acesso_liberado() or public.meu_setor() is distinct from 'recepcao' then
    raise exception 'Só a Recepção cadastra contato pelo atendimento.' using errcode = '42501';
  end if;

  select * into v_atendimento from public.atendimentos where id = p_atendimento_id for update;
  if not found
     or v_atendimento.status <> 'em_andamento'
     or v_atendimento.setor <> 'recepcao'
     or v_atendimento.funcionario_id is distinct from auth.uid() then
    raise exception 'Você não pode cadastrar contato neste Atendimento.' using errcode = '42501';
  end if;

  if v_atendimento.cliente_id is not null and v_atendimento.cliente_id <> p_cliente_id then
    raise exception 'Este Atendimento já é de outro Cliente.' using errcode = '22023';
  end if;

  select cnpj into v_cnpj from public.clientes where id = p_cliente_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  if v_nome = '' then
    raise exception 'O nome do contato é obrigatório.' using errcode = '22023';
  end if;
  v_chave := public.chave_telefone(v_atendimento.telefone);
  if v_chave is null then
    raise exception 'O atendimento não tem um WhatsApp válido.' using errcode = '22023';
  end if;

  select * into v_existente from public.cliente_contatos
   where cliente_id = p_cliente_id and public.chave_telefone(telefone) = v_chave;
  if found then
    return jsonb_build_object('status', 'existente', 'contato_id', v_existente.id, 'nome', v_existente.nome);
  end if;

  if exists (select 1 from public.cliente_contatos
              where cliente_id <> p_cliente_id and public.chave_telefone(telefone) = v_chave) then
    return jsonb_build_object('status', 'em_outro_cliente');
  end if;

  if v_email is not null then
    select * into v_existente from public.cliente_contatos
     where cliente_id = p_cliente_id and email = v_email;
    if found then
      return jsonb_build_object('status', 'email_em_uso', 'contato_id', v_existente.id, 'nome', v_existente.nome);
    end if;
  end if;

  perform set_config('app.cliente_auditado', p_cliente_id::text, true);
  begin
    insert into public.cliente_contatos (id, cliente_id, nome, telefone, email, dono_setor)
    values (v_id, p_cliente_id, v_nome, v_chave, v_email, 'recepcao');
  exception when unique_violation then
    select * into v_existente from public.cliente_contatos
     where cliente_id = p_cliente_id and public.chave_telefone(telefone) = v_chave;
    if found then
      return jsonb_build_object('status', 'existente', 'contato_id', v_existente.id, 'nome', v_existente.nome);
    end if;
    if exists (select 1 from public.cliente_contatos
                where cliente_id <> p_cliente_id and public.chave_telefone(telefone) = v_chave) then
      return jsonb_build_object('status', 'em_outro_cliente');
    end if;
    select * into v_existente from public.cliente_contatos
     where cliente_id = p_cliente_id and email = v_email;
    if found then
      return jsonb_build_object('status', 'email_em_uso', 'contato_id', v_existente.id, 'nome', v_existente.nome);
    end if;
    raise;
  end;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), 'recepcao', 'contato.cadastrar-ura', v_cnpj, 'sucesso', now());

  return jsonb_build_object('status', 'criado', 'contato_id', v_id, 'nome', v_nome);
end;
$$;
REVOKE ALL ON FUNCTION public.cadastrar_contato_ura(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cadastrar_contato_ura(uuid, uuid, text, text) TO authenticated, service_role;

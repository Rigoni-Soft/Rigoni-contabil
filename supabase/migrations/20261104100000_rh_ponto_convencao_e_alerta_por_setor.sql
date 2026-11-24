
CREATE TABLE public.rh_servicos_acompanhamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ordem bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    sistema boolean DEFAULT false NOT NULL,
    ativo_desde date NOT NULL,
    desativado_em timestamp with time zone,
    CONSTRAINT rh_servicos_acompanhamento_pkey PRIMARY KEY (id),
    CONSTRAINT rh_servicos_acompanhamento_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 40),
    CONSTRAINT rh_servicos_acompanhamento_mes_check CHECK (ativo_desde = date_trunc('month', ativo_desde)::date)
);
CREATE UNIQUE INDEX rh_servicos_acompanhamento_nome_ativo_idx
    ON public.rh_servicos_acompanhamento (lower(btrim(nome))) WHERE desativado_em IS NULL;

CREATE TABLE public.rh_cliente_servico_aplica (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    servico_id uuid NOT NULL REFERENCES public.rh_servicos_acompanhamento(id) ON DELETE CASCADE,
    aplica boolean NOT NULL,
    competencia date,
    CONSTRAINT rh_cliente_servico_aplica_pkey PRIMARY KEY (id),
    CONSTRAINT rh_cliente_servico_aplica_mes_check
        CHECK (competencia IS NULL OR competencia = date_trunc('month', competencia)::date),
    CONSTRAINT rh_cliente_servico_aplica_unico UNIQUE (cliente_id, servico_id, competencia)
);
CREATE UNIQUE INDEX rh_cliente_servico_aplica_sempre_idx
    ON public.rh_cliente_servico_aplica (cliente_id, servico_id) WHERE competencia IS NULL;

CREATE TABLE public.rh_acompanhamento_marcacoes (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    servico_id uuid NOT NULL REFERENCES public.rh_servicos_acompanhamento(id) ON DELETE CASCADE,
    competencia date NOT NULL,
    marcado_por uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    marcado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_acompanhamento_marcacoes_pkey PRIMARY KEY (cliente_id, servico_id, competencia),
    CONSTRAINT rh_acompanhamento_marcacoes_mes_check CHECK (competencia = date_trunc('month', competencia)::date)
);
CREATE INDEX rh_acompanhamento_marcacoes_competencia_idx ON public.rh_acompanhamento_marcacoes (competencia);

INSERT INTO public.rh_servicos_acompanhamento (nome, ativo_desde, sistema) VALUES
    ('FGTS', '2000-01-01', false),
    ('DCTFWeb', '2000-01-01', false),
    ('NUTRI', '2000-01-01', false),
    ('SIB', '2000-01-01', false),
    ('Sindicato', '2000-01-01', false),
    ('Holerite', '2000-01-01', true);

CREATE FUNCTION public.pode_ver_acompanhamento_rh(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and coalesce(case public.meu_papel()
    when 'admin' then true
    when 'lider_setor' then public.meu_setor() = 'rh'
    when 'funcionario' then
      public.meu_setor() = 'rh' and public.sou_responsavel_do_cliente_no_setor(p_cliente_id, 'rh')
    else false
  end, false);
$$;

CREATE FUNCTION public.sou_responsavel_rh_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado()
     and public.meu_papel() = 'funcionario' and public.meu_setor() = 'rh'
     and public.sou_responsavel_do_cliente_no_setor(p_cliente_id, 'rh');
$$;

CREATE FUNCTION public.servico_rh_ativo_na_competencia(p_servico_id uuid, p_competencia date) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.rh_servicos_acompanhamento s
    where s.id = p_servico_id
      and s.ativo_desde <= p_competencia
      and (s.desativado_em is null
           or p_competencia < date_trunc('month', s.desativado_em at time zone 'America/Sao_Paulo')::date)
  );
$$;

CREATE FUNCTION public.servico_rh_editavel(p_servico_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.rh_servicos_acompanhamento where id = p_servico_id and not sistema);
$$;

REVOKE ALL ON FUNCTION public.pode_ver_acompanhamento_rh(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sou_responsavel_rh_do_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.servico_rh_ativo_na_competencia(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.servico_rh_editavel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_acompanhamento_rh(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sou_responsavel_rh_do_cliente(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.servico_rh_ativo_na_competencia(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.servico_rh_editavel(uuid) TO authenticated, service_role;

CREATE FUNCTION public.proteger_servico_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.ativo_desde := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
      new.desativado_em := null;
    end if;
    return new;
  end if;
  if new.id <> old.id or new.sistema <> old.sistema or new.ativo_desde <> old.ativo_desde
     or new.ordem <> old.ordem then
    raise exception 'servico_rh_imutavel';
  end if;
  if old.desativado_em is not null then
    raise exception 'servico_rh_desativado';
  end if;
  if old.desativado_em is null and new.desativado_em is not null then
    new.desativado_em := now();
  end if;
  return new;
end;
$$;
CREATE TRIGGER rh_servicos_acompanhamento_proteger BEFORE INSERT OR UPDATE ON public.rh_servicos_acompanhamento
    FOR EACH ROW EXECUTE FUNCTION public.proteger_servico_rh();

CREATE FUNCTION public.proteger_marcacao_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.servico_rh_editavel(new.servico_id) then
    raise exception 'servico_rh_do_sistema';
  end if;
  if not public.servico_rh_ativo_na_competencia(new.servico_id, new.competencia) then
    raise exception 'servico_rh_fora_da_competencia';
  end if;
  if exists (
    select 1 from public.rh_cliente_servico_aplica a
    where a.cliente_id = new.cliente_id and a.servico_id = new.servico_id and not a.aplica
      and (a.competencia is null or a.competencia = new.competencia)
  ) then
    raise exception 'servico_rh_nao_se_aplica';
  end if;
  if new.competencia > date_trunc('month', now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'competencia_futura';
  end if;
  new.marcado_por := coalesce(auth.uid(), new.marcado_por);
  new.marcado_em := now();
  return new;
end;
$$;
CREATE TRIGGER rh_acompanhamento_marcacoes_proteger BEFORE INSERT OR UPDATE ON public.rh_acompanhamento_marcacoes
    FOR EACH ROW EXECUTE FUNCTION public.proteger_marcacao_rh();

CREATE FUNCTION public.auditar_rh_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_acao text;
  v_alvo text;
  v_cliente uuid;
  v_servico uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'rh_servicos_acompanhamento' then
    if tg_op = 'INSERT' then
      v_acao := 'rh.servico.criar';
    elsif new.desativado_em is not null and old.desativado_em is null then
      v_acao := 'rh.servico.desativar';
    elsif new.nome <> old.nome then
      v_acao := 'rh.servico.renomear';
    else
      return null;
    end if;
    v_alvo := new.nome;
  else
    v_cliente := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
    v_servico := case when tg_op = 'DELETE' then old.servico_id else new.servico_id end;
    if tg_table_name = 'rh_cliente_servico_aplica' then
      if tg_op = 'DELETE' then
        v_acao := 'rh.acompanhamento.aplicar';
      else
        v_acao := case when new.aplica then 'rh.acompanhamento.aplicar' else 'rh.acompanhamento.nao-aplicar' end;
      end if;
      v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = v_cliente), '?')
        || ' ' || coalesce((select s.nome from public.rh_servicos_acompanhamento s where s.id = v_servico), '?')
        || ' ' || coalesce(to_char(case when tg_op = 'DELETE' then old.competencia else new.competencia end, 'YYYY-MM'), 'sempre');
    else
      v_acao := case when tg_op = 'DELETE' then 'rh.acompanhamento.desmarcar' else 'rh.acompanhamento.marcar' end;
      v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = v_cliente), '?')
        || ' ' || coalesce((select s.nome from public.rh_servicos_acompanhamento s where s.id = v_servico), '?')
        || ' ' || to_char(case when tg_op = 'DELETE' then old.competencia else new.competencia end, 'YYYY-MM');
    end if;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), public.meu_setor(), v_acao, v_alvo, 'sucesso', now());
  return null;
end;
$$;
CREATE TRIGGER rh_servicos_acompanhamento_auditar AFTER INSERT OR UPDATE ON public.rh_servicos_acompanhamento
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_acompanhamento();
CREATE TRIGGER rh_cliente_servico_aplica_auditar AFTER INSERT OR UPDATE OR DELETE ON public.rh_cliente_servico_aplica
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_acompanhamento();
CREATE FUNCTION public.limpar_marcacao_rh_nao_aplica() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not new.aplica then
    delete from public.rh_acompanhamento_marcacoes
    where cliente_id = new.cliente_id and servico_id = new.servico_id
      and (new.competencia is null or competencia = new.competencia);
  end if;
  return null;
end;
$$;
CREATE TRIGGER rh_cliente_servico_aplica_limpar_marcacao AFTER INSERT OR UPDATE ON public.rh_cliente_servico_aplica
    FOR EACH ROW EXECUTE FUNCTION public.limpar_marcacao_rh_nao_aplica();

CREATE TRIGGER rh_acompanhamento_marcacoes_auditar AFTER INSERT OR DELETE ON public.rh_acompanhamento_marcacoes
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_acompanhamento();

ALTER TABLE public.rh_servicos_acompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_cliente_servico_aplica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_acompanhamento_marcacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_servicos_select ON public.rh_servicos_acompanhamento FOR SELECT USING (
    public.acesso_liberado() AND (public.meu_papel() = 'admin' OR public.meu_setor() = 'rh'));
CREATE POLICY rh_servicos_insert ON public.rh_servicos_acompanhamento FOR INSERT WITH CHECK (
    public.acesso_liberado() AND public.meu_papel() = 'lider_setor' AND public.meu_setor() = 'rh'
    AND NOT sistema);
CREATE POLICY rh_servicos_update ON public.rh_servicos_acompanhamento FOR UPDATE USING (
    public.acesso_liberado() AND public.meu_papel() = 'lider_setor' AND public.meu_setor() = 'rh'
    AND NOT sistema)
  WITH CHECK (
    public.acesso_liberado() AND public.meu_papel() = 'lider_setor' AND public.meu_setor() = 'rh'
    AND NOT sistema);

CREATE POLICY rh_aplica_select ON public.rh_cliente_servico_aplica FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_aplica_insert ON public.rh_cliente_servico_aplica FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(cliente_id) AND public.servico_rh_editavel(servico_id));
CREATE POLICY rh_aplica_update ON public.rh_cliente_servico_aplica FOR UPDATE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id))
  WITH CHECK (public.sou_responsavel_rh_do_cliente(cliente_id) AND public.servico_rh_editavel(servico_id));
CREATE POLICY rh_aplica_delete ON public.rh_cliente_servico_aplica FOR DELETE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id));

CREATE POLICY rh_marcacoes_select ON public.rh_acompanhamento_marcacoes FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_marcacoes_insert ON public.rh_acompanhamento_marcacoes FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(cliente_id));
CREATE POLICY rh_marcacoes_delete ON public.rh_acompanhamento_marcacoes FOR DELETE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id));

REVOKE ALL ON TABLE public.rh_servicos_acompanhamento, public.rh_cliente_servico_aplica,
    public.rh_acompanhamento_marcacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_servicos_acompanhamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rh_cliente_servico_aplica TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rh_acompanhamento_marcacoes TO authenticated;
GRANT ALL ON TABLE public.rh_servicos_acompanhamento, public.rh_cliente_servico_aplica,
    public.rh_acompanhamento_marcacoes TO service_role;

CREATE FUNCTION public.definir_aplica_rh(p_cliente_id uuid, p_servico_id uuid, p_competencia date, p_escopo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.sou_responsavel_rh_do_cliente(p_cliente_id) then
    raise exception 'Sem permissão para alterar o acompanhamento do RH.' using errcode = '42501';
  end if;
  if not public.servico_rh_editavel(p_servico_id) then
    raise exception 'servico_rh_do_sistema';
  end if;
  if p_escopo not in ('aplica', 'mes', 'sempre') or p_competencia <> date_trunc('month', p_competencia)::date then
    raise exception 'Escopo ou competência inválidos.' using errcode = '22023';
  end if;
  if p_escopo = 'mes' and p_competencia > date_trunc('month', now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'competencia_futura';
  end if;

  if p_escopo = 'aplica' then
    delete from public.rh_cliente_servico_aplica
    where cliente_id = p_cliente_id and servico_id = p_servico_id
      and (competencia is null or competencia = p_competencia);
  elsif p_escopo = 'mes' then
    delete from public.rh_cliente_servico_aplica
    where cliente_id = p_cliente_id and servico_id = p_servico_id and competencia is null;
    insert into public.rh_cliente_servico_aplica (cliente_id, servico_id, aplica, competencia)
    values (p_cliente_id, p_servico_id, false, p_competencia)
    on conflict (cliente_id, servico_id, competencia) do nothing;
  else
    delete from public.rh_cliente_servico_aplica where cliente_id = p_cliente_id and servico_id = p_servico_id;
    insert into public.rh_cliente_servico_aplica (cliente_id, servico_id, aplica, competencia)
    values (p_cliente_id, p_servico_id, false, null)
    on conflict (cliente_id, servico_id) where competencia is null do nothing;
  end if;
end;
$$;
REVOKE ALL ON FUNCTION public.definir_aplica_rh(uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_aplica_rh(uuid, uuid, date, text) TO authenticated, service_role;


CREATE TABLE public.cliente_observacoes_setor (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    setor public.setor_slug NOT NULL,
    observacoes text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliente_observacoes_setor_pkey PRIMARY KEY (cliente_id, setor),
    CONSTRAINT cliente_observacoes_setor_tamanho_check CHECK (char_length(observacoes) <= 2000)
);
ALTER TABLE public.cliente_observacoes_setor ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cliente_observacoes_setor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cliente_observacoes_setor TO authenticated;
GRANT ALL ON TABLE public.cliente_observacoes_setor TO service_role;

CREATE POLICY cliente_observacoes_setor_select ON public.cliente_observacoes_setor
    FOR SELECT TO authenticated
    USING (public.meu_papel() = 'admin'
           OR (public.pode_ver_cliente(cliente_id) AND public.meu_setor() = setor));

CREATE OR REPLACE FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p_cliente_id is not null
    and public.pode_ver_cliente(p_cliente_id)
    and (public.meu_papel() = 'admin' or public.meu_setor() in ('simples_nacional', 'rh'));
$$;

CREATE OR REPLACE FUNCTION public.proteger_cadastro_operacional() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;
  if not (tg_table_name = 'cliente_contatos' and coalesce(current_setting('app.cadastro_rh', true), '') = 'on')
     and not exists (
    select 1 from public.clientes
    where id = v_cliente_id and regime in ('simples_nacional', 'mei')
  ) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  if tg_table_name = 'cliente_atividades_mensais' then
    if new.ano_mes <> public.mes_corrente_sp()
       or (tg_op = 'UPDATE' and old.ano_mes <> public.mes_corrente_sp()) then
      raise exception 'Só a Atividade do mês corrente é editável.' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;


DROP INDEX public.alertas_setor_um_aberto_por_cliente_tipo_e_origem;
CREATE UNIQUE INDEX alertas_setor_um_aberto_por_cliente_tipo_origem_e_setor
  ON public.alertas_setor USING btree (cliente_id, tipo, origem, setor) WHERE (resolvido_em IS NULL);

CREATE OR REPLACE FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text DEFAULT 'lembretes'::text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem, origem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem, p_origem)
  on conflict (cliente_id, tipo, origem, setor) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

CREATE OR REPLACE FUNCTION public.pendencias_guia_pgfn(p_cliente_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
                    'codigo', p.codigo,
                    'setor', p.setor,
                    'estado', case when g.parcelamento_id is null then 'sem_guia' else 'a_confirmar' end
                  ) order by p.setor, p.codigo), '[]'::jsonb)
    from public.cliente_parcelamentos p
    left join public.cliente_parcelamento_guias g
      on g.parcelamento_id = p.id
     and g.competencia = to_char(public.mes_corrente_sp(), 'YYYYMM')
   where p.cliente_id = p_cliente_id
     and p.origem = 'pgfn' and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
     and g.estado is distinct from 'confirmada';
$$;

CREATE OR REPLACE FUNCTION public.resolver_alerta_guia_pgfn_confirmada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid;
  v_setor public.setor_slug;
begin
  select p.cliente_id, p.setor into v_cliente_id, v_setor
    from public.cliente_parcelamentos p where p.id = new.parcelamento_id;

  if not exists (
    select 1 from jsonb_array_elements(public.pendencias_guia_pgfn(v_cliente_id)) as pendencia
     where pendencia ->> 'setor' = v_setor::text
  ) then
    update public.alertas_setor
       set resolvido_em = now()
     where cliente_id = v_cliente_id and setor = v_setor and origem = 'lembrete_pgfn'
       and resolvido_em is null;
  end if;
  return null;
end;
$$;


CREATE TABLE public.rh_ponto_padroes (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    comissionados boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_ponto_padroes_pkey PRIMARY KEY (cliente_id)
);

CREATE TABLE public.rh_empregados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nome text NOT NULL,
    jornada smallint[] NOT NULL,
    comissionado boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT rh_empregados_pkey PRIMARY KEY (id),
    CONSTRAINT rh_empregados_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 120),
    CONSTRAINT rh_empregados_jornada_check CHECK (
        array_length(jornada, 1) = 7
        AND array_position(jornada, NULL) IS NULL
        AND jornada[1] BETWEEN 0 AND 1440 AND jornada[2] BETWEEN 0 AND 1440 AND jornada[3] BETWEEN 0 AND 1440
        AND jornada[4] BETWEEN 0 AND 1440 AND jornada[5] BETWEEN 0 AND 1440 AND jornada[6] BETWEEN 0 AND 1440
        AND jornada[7] BETWEEN 0 AND 1440
    )
);
CREATE INDEX rh_empregados_cliente_idx ON public.rh_empregados (cliente_id);

CREATE FUNCTION public.rh_pares_de_batida_validos(p jsonb, p_maximo integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= p_maximo
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or (select count(*) from jsonb_object_keys(e)) <> 2
         or jsonb_typeof(e -> 'entrada') <> 'number' or jsonb_typeof(e -> 'saida') <> 'number'
         or (e ->> 'entrada') !~ '^[0-9]{1,4}$' or (e ->> 'saida') !~ '^[0-9]{1,4}$'
         or (e ->> 'entrada')::int > 1439 or (e ->> 'saida')::int > 1439
    );
$$;

CREATE TABLE public.rh_ponto_dias (
    empregado_id uuid NOT NULL REFERENCES public.rh_empregados(id) ON DELETE CASCADE,
    data date NOT NULL,
    batidas jsonb DEFAULT '[]'::jsonb NOT NULL,
    extra jsonb,
    abono boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_ponto_dias_pkey PRIMARY KEY (empregado_id, data),
    CONSTRAINT rh_ponto_dias_batidas_check CHECK (public.rh_pares_de_batida_validos(batidas, 4)),
    CONSTRAINT rh_ponto_dias_extra_check CHECK (
        extra IS NULL OR public.rh_pares_de_batida_validos(jsonb_build_array(extra), 1)
    )
);

CREATE TABLE public.rh_empregado_sem_movimento (
    empregado_id uuid NOT NULL REFERENCES public.rh_empregados(id) ON DELETE CASCADE,
    competencia date NOT NULL,
    CONSTRAINT rh_empregado_sem_movimento_pkey PRIMARY KEY (empregado_id, competencia),
    CONSTRAINT rh_empregado_sem_movimento_mes_check CHECK (competencia = date_trunc('month', competencia)::date)
);

CREATE FUNCTION public.cliente_do_empregado_rh(p_empregado_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select cliente_id from public.rh_empregados where id = p_empregado_id;
$$;
REVOKE ALL ON FUNCTION public.cliente_do_empregado_rh(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_do_empregado_rh(uuid) TO authenticated, service_role;

CREATE FUNCTION public.proteger_ponto_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_table_name = 'rh_empregados' then
    if new.cliente_id <> old.cliente_id then
      raise exception 'rh_empregado_cliente_imutavel';
    end if;
    return new;
  end if;
  if tg_table_name = 'rh_ponto_dias' and tg_op = 'UPDATE' then
    if new.data <> old.data or new.empregado_id <> old.empregado_id then
      raise exception 'rh_ponto_dia_imutavel';
    end if;
  end if;
  if not exists (select 1 from public.rh_empregados where id = new.empregado_id and ativo) then
    raise exception 'rh_empregado_inativo';
  end if;
  return new;
end;
$$;
CREATE TRIGGER rh_empregados_proteger BEFORE UPDATE ON public.rh_empregados
    FOR EACH ROW EXECUTE FUNCTION public.proteger_ponto_rh();
CREATE TRIGGER rh_ponto_dias_proteger BEFORE INSERT OR UPDATE ON public.rh_ponto_dias
    FOR EACH ROW EXECUTE FUNCTION public.proteger_ponto_rh();
CREATE TRIGGER rh_empregado_sem_movimento_proteger BEFORE INSERT ON public.rh_empregado_sem_movimento
    FOR EACH ROW EXECUTE FUNCTION public.proteger_ponto_rh();

CREATE FUNCTION public.auditar_rh_ponto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_acao text;
  v_alvo text;
  v_cliente uuid;
  v_nome text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'rh_ponto_padroes' then
    v_acao := 'rh.ponto.padrao-comissionados';
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = new.cliente_id), '?')
      || case when new.comissionados then ' sim' else ' nao' end;
  elsif tg_table_name = 'rh_empregados' then
    if tg_op = 'INSERT' then
      v_acao := 'rh.empregado.cadastrar';
    elsif new.ativo and not old.ativo then
      v_acao := 'rh.empregado.reativar';
    elsif not new.ativo and old.ativo then
      v_acao := 'rh.empregado.inativar';
    else
      v_acao := 'rh.empregado.corrigir';
    end if;
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = new.cliente_id), '?') || ' ' || new.nome;
  else
    select e.cliente_id, e.nome into v_cliente, v_nome
    from public.rh_empregados e
    where e.id = case when tg_op = 'DELETE' then old.empregado_id else new.empregado_id end;
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = v_cliente), '?') || ' ' || coalesce(v_nome, '?');
    if tg_table_name = 'rh_ponto_dias' then
      v_acao := case when tg_op = 'DELETE' then 'rh.ponto.limpar' else 'rh.ponto.salvar' end;
      v_alvo := v_alvo || ' ' || to_char(case when tg_op = 'DELETE' then old.data else new.data end, 'YYYY-MM-DD');
    else
      v_acao := case when tg_op = 'DELETE' then 'rh.ponto.com-movimento' else 'rh.ponto.sem-movimento' end;
      v_alvo := v_alvo || ' ' || to_char(case when tg_op = 'DELETE' then old.competencia else new.competencia end, 'YYYY-MM');
    end if;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), public.meu_setor(), v_acao, v_alvo, 'sucesso', now());
  return null;
end;
$$;
CREATE TRIGGER rh_ponto_padroes_auditar AFTER INSERT OR UPDATE ON public.rh_ponto_padroes
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_ponto();
CREATE TRIGGER rh_empregados_auditar AFTER INSERT OR UPDATE ON public.rh_empregados
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_ponto();
CREATE TRIGGER rh_ponto_dias_auditar AFTER INSERT OR UPDATE OR DELETE ON public.rh_ponto_dias
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_ponto();
CREATE TRIGGER rh_empregado_sem_movimento_auditar AFTER INSERT OR DELETE ON public.rh_empregado_sem_movimento
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_ponto();

ALTER TABLE public.rh_ponto_padroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_empregados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_ponto_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_empregado_sem_movimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_ponto_padroes_select ON public.rh_ponto_padroes FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_ponto_padroes_insert ON public.rh_ponto_padroes FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(cliente_id));
CREATE POLICY rh_ponto_padroes_update ON public.rh_ponto_padroes FOR UPDATE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id))
  WITH CHECK (public.sou_responsavel_rh_do_cliente(cliente_id));

CREATE POLICY rh_empregados_select ON public.rh_empregados FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_empregados_insert ON public.rh_empregados FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(cliente_id));
CREATE POLICY rh_empregados_update ON public.rh_empregados FOR UPDATE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id))
  WITH CHECK (public.sou_responsavel_rh_do_cliente(cliente_id));

CREATE POLICY rh_ponto_dias_select ON public.rh_ponto_dias FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_ponto_dias_insert ON public.rh_ponto_dias FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_ponto_dias_update ON public.rh_ponto_dias FOR UPDATE USING (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)))
  WITH CHECK (public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_ponto_dias_delete ON public.rh_ponto_dias FOR DELETE USING (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));

CREATE POLICY rh_sem_movimento_select ON public.rh_empregado_sem_movimento FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_sem_movimento_insert ON public.rh_empregado_sem_movimento FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_sem_movimento_delete ON public.rh_empregado_sem_movimento FOR DELETE USING (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));

REVOKE ALL ON TABLE public.rh_ponto_padroes, public.rh_empregados, public.rh_ponto_dias,
    public.rh_empregado_sem_movimento FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_ponto_padroes, public.rh_empregados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rh_ponto_dias TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rh_empregado_sem_movimento TO authenticated;
GRANT ALL ON TABLE public.rh_ponto_padroes, public.rh_empregados, public.rh_ponto_dias,
    public.rh_empregado_sem_movimento TO service_role;

CREATE POLICY feriados_select_rh ON public.feriados FOR SELECT TO authenticated USING (
    public.acesso_liberado() AND public.meu_setor() = 'rh');


CREATE FUNCTION public.rh_regras_da_convencao_validas(regras jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  item jsonb;
  elemento jsonb;
  chave text;
  valor jsonb;
begin
  if not coalesce(
    jsonb_typeof(regras) = 'object'
    and jsonb_typeof(regras -> 'versao') = 'number'
    and jsonb_typeof(regras -> 'aplicadas') = 'array'
    and jsonb_typeof(regras -> 'rejeitadas') = 'array', false) then
    return false;
  end if;

  for item in select * from jsonb_array_elements(regras -> 'rejeitadas') loop
    if not coalesce(
      jsonb_typeof(item) = 'object'
      and jsonb_typeof(item -> 'chave') = 'string'
      and item ->> 'motivo' in ('chave_desconhecida', 'sem_citacao', 'valor_invalido', 'fora_do_trecho',
                                'abaixo_da_legislacao', 'duplicada'), false) then
      return false;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(regras -> 'aplicadas') loop
    if not coalesce(
      jsonb_typeof(item) = 'object'
      and jsonb_typeof(item -> 'chave') = 'string'
      and jsonb_typeof(item -> 'clausula') = 'string'
      and char_length(btrim(item ->> 'clausula')) between 1 and 120
      and jsonb_typeof(item -> 'trecho') = 'string'
      and char_length(btrim(item ->> 'trecho')) between 1 and 2000, false) then
      return false;
    end if;
    chave := item ->> 'chave';
    valor := item -> 'valor';
    if chave in ('jornada_semanal', 'jornada_diaria', 'limite_extras_dia', 'intervalo_minimo',
                 'intervalo_maximo', 'extra_sabado') then
      if jsonb_typeof(valor) is distinct from 'number' or (valor #>> '{}')::numeric <= 0 then
        return false;
      end if;
    elsif chave in ('datas_especiais', 'excecoes_de_feriado') then
      if jsonb_typeof(valor) is distinct from 'array' or jsonb_array_length(valor) = 0 then
        return false;
      end if;
      for elemento in select * from jsonb_array_elements(valor) loop
        if not coalesce(
          jsonb_typeof(elemento) = 'object'
          and jsonb_typeof(elemento -> 'descricao') = 'string'
          and btrim(elemento ->> 'descricao') <> '', false) then
          return false;
        end if;
        if chave = 'datas_especiais' and not coalesce(
          jsonb_typeof(elemento -> 'percentual') = 'number'
          and (elemento ->> 'percentual')::numeric between 0.000001 and 300, false) then
          return false;
        end if;
      end loop;
    else
      return false;
    end if;
  end loop;
  return true;
end;
$$;

REVOKE ALL ON FUNCTION public.rh_regras_da_convencao_validas(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_regras_da_convencao_validas(jsonb) TO authenticated, service_role;

CREATE TABLE public.rh_convencoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    sindicato text NOT NULL,
    vigencia_inicio date NOT NULL,
    vigencia_fim date NOT NULL,
    arquivo_caminho text NOT NULL,
    arquivo_nome text NOT NULL,
    regras jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    CONSTRAINT rh_convencoes_pkey PRIMARY KEY (id),
    CONSTRAINT rh_convencoes_sindicato_check CHECK (char_length(btrim(sindicato)) BETWEEN 1 AND 120),
    CONSTRAINT rh_convencoes_vigencia_check CHECK (vigencia_fim >= vigencia_inicio),
    CONSTRAINT rh_convencoes_arquivo_caminho_check CHECK (arquivo_caminho LIKE cliente_id::text || '/%'),
    CONSTRAINT rh_convencoes_arquivo_caminho_unico UNIQUE (arquivo_caminho),
    CONSTRAINT rh_convencoes_arquivo_nome_check CHECK (char_length(btrim(arquivo_nome)) BETWEEN 1 AND 255),
    CONSTRAINT rh_convencoes_regras_check CHECK (public.rh_regras_da_convencao_validas(regras))
);
CREATE INDEX rh_convencoes_cliente_idx ON public.rh_convencoes (cliente_id, vigencia_inicio DESC);

CREATE TABLE public.rh_cliente_interruptores (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    banco_de_horas boolean DEFAULT false NOT NULL,
    trabalho_aos_domingos boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_cliente_interruptores_pkey PRIMARY KEY (cliente_id)
);

ALTER TABLE public.rh_empregados
    ADD COLUMN convencao_sindicato text,
    ADD CONSTRAINT rh_empregados_convencao_sindicato_check CHECK (
        convencao_sindicato IS NULL OR char_length(btrim(convencao_sindicato)) BETWEEN 1 AND 120
    );

CREATE FUNCTION public.pode_gerir_convencao_rh() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and coalesce(
    public.meu_papel() = 'admin' or (public.meu_papel() = 'lider_setor' and public.meu_setor() = 'rh'),
    false);
$$;
REVOKE ALL ON FUNCTION public.pode_gerir_convencao_rh() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_gerir_convencao_rh() TO authenticated, service_role;

CREATE FUNCTION public.auditar_rh_convencao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cnpj text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select c.cnpj into v_cnpj from public.clientes c where c.id = new.cliente_id;
  v_cnpj := coalesce(v_cnpj, '?');

  if tg_table_name = 'rh_convencoes' then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), auth.uid(), public.meu_setor(), 'rh.convencao.enviar',
      v_cnpj || ' ' || new.sindicato || ' ' || to_char(new.vigencia_inicio, 'YYYY-MM-DD'), 'sucesso', now());
  else
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), auth.uid(), public.meu_setor(), 'rh.cliente.interruptores',
      v_cnpj || ' banco=' || case when new.banco_de_horas then 'sim' else 'nao' end
        || ' domingos=' || case when new.trabalho_aos_domingos then 'sim' else 'nao' end, 'sucesso', now());
  end if;
  return null;
end;
$$;
CREATE TRIGGER rh_convencoes_auditar AFTER INSERT ON public.rh_convencoes
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_convencao();
CREATE TRIGGER rh_cliente_interruptores_auditar AFTER INSERT OR UPDATE ON public.rh_cliente_interruptores
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_convencao();

ALTER TABLE public.rh_convencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_cliente_interruptores ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_convencoes_select ON public.rh_convencoes FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_convencoes_insert ON public.rh_convencoes FOR INSERT WITH CHECK (
    public.pode_gerir_convencao_rh());

CREATE POLICY rh_interruptores_select ON public.rh_cliente_interruptores FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(cliente_id));
CREATE POLICY rh_interruptores_insert ON public.rh_cliente_interruptores FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(cliente_id));
CREATE POLICY rh_interruptores_update ON public.rh_cliente_interruptores FOR UPDATE USING (
    public.sou_responsavel_rh_do_cliente(cliente_id))
  WITH CHECK (public.sou_responsavel_rh_do_cliente(cliente_id));

REVOKE ALL ON TABLE public.rh_convencoes, public.rh_cliente_interruptores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.rh_convencoes TO authenticated;
GRANT INSERT (cliente_id, sindicato, vigencia_inicio, vigencia_fim, arquivo_caminho, arquivo_nome, regras)
    ON TABLE public.rh_convencoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_cliente_interruptores TO authenticated;
GRANT ALL ON TABLE public.rh_convencoes, public.rh_cliente_interruptores TO service_role;

CREATE FUNCTION public.proteger_convencao_do_empregado_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.convencao_sindicato is not null
     and (tg_op = 'INSERT' or new.convencao_sindicato is distinct from old.convencao_sindicato)
     and not exists (
       select 1 from public.rh_convencoes
       where cliente_id = new.cliente_id and sindicato = new.convencao_sindicato) then
    raise exception 'rh_convencao_inexistente';
  end if;
  return new;
end;
$$;
CREATE TRIGGER rh_empregados_convencao_proteger BEFORE INSERT OR UPDATE ON public.rh_empregados
    FOR EACH ROW EXECUTE FUNCTION public.proteger_convencao_do_empregado_rh();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('convencoes-coletivas', 'convencoes-coletivas', false, 10485760, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;


CREATE FUNCTION public.convencao_rh_usa_arquivo(p_caminho text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.rh_convencoes where arquivo_caminho = p_caminho);
$$;
REVOKE ALL ON FUNCTION public.convencao_rh_usa_arquivo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convencao_rh_usa_arquivo(text) TO authenticated, service_role;

CREATE POLICY convencoes_coletivas_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
                AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$');
CREATE POLICY convencoes_coletivas_select_sem_convencao ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
           AND NOT public.convencao_rh_usa_arquivo(name));
CREATE POLICY convencoes_coletivas_delete_sem_convencao ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
           AND NOT public.convencao_rh_usa_arquivo(name));

CREATE FUNCTION public.rh_cartoes_do_mes(p_competencia date)
RETURNS TABLE (cliente_id uuid, cadastrados integer, sem_movimento integer, cartoes integer)
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
  select e.cliente_id,
         count(*)::int,
         (count(*) filter (where sm.empregado_id is not null))::int,
         (count(*) filter (where sm.empregado_id is null and d.salvo))::int
  from public.rh_empregados e
  left join public.rh_empregado_sem_movimento sm
    on sm.empregado_id = e.id and sm.competencia = p_competencia
  cross join lateral (
    select exists (
      select 1 from public.rh_ponto_dias pd
      where pd.empregado_id = e.id
        and pd.data >= p_competencia
        and pd.data < (p_competencia + interval '1 month')::date
    ) as salvo
  ) d
  where e.ativo
  group by e.cliente_id;
$$;
REVOKE ALL ON FUNCTION public.rh_cartoes_do_mes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_cartoes_do_mes(date) TO authenticated, service_role;

CREATE TABLE public.rh_cartoes_iniciados (
    empregado_id uuid NOT NULL REFERENCES public.rh_empregados(id) ON DELETE CASCADE,
    competencia date NOT NULL,
    CONSTRAINT rh_cartoes_iniciados_pkey PRIMARY KEY (empregado_id, competencia),
    CONSTRAINT rh_cartoes_iniciados_mes_check CHECK (competencia = date_trunc('month', competencia)::date)
);

CREATE TRIGGER rh_cartoes_iniciados_proteger BEFORE INSERT ON public.rh_cartoes_iniciados
    FOR EACH ROW EXECUTE FUNCTION public.proteger_ponto_rh();

CREATE FUNCTION public.auditar_rh_cartao_iniciado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), auth.uid(), public.meu_setor(), 'rh.ponto.iniciar-cartao',
         coalesce(c.cnpj, '?') || ' ' || e.nome || ' ' || to_char(new.competencia, 'YYYY-MM'), 'sucesso', now()
  from public.rh_empregados e
  left join public.clientes c on c.id = e.cliente_id
  where e.id = new.empregado_id;
  return null;
end;
$$;
CREATE TRIGGER rh_cartoes_iniciados_auditar AFTER INSERT ON public.rh_cartoes_iniciados
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_cartao_iniciado();

ALTER TABLE public.rh_cartoes_iniciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_cartoes_iniciados_select ON public.rh_cartoes_iniciados FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_cartoes_iniciados_insert ON public.rh_cartoes_iniciados FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));

REVOKE ALL ON TABLE public.rh_cartoes_iniciados FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rh_cartoes_iniciados TO authenticated;
GRANT ALL ON TABLE public.rh_cartoes_iniciados TO service_role;
REVOKE ALL ON FUNCTION public.auditar_rh_cartao_iniciado() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.proteger_ponto_rh() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditar_rh_ponto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditar_rh_convencao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.proteger_convencao_do_empregado_rh() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rh_gravar_cartao(p_empregado_id uuid, p_competencia date, p_dias jsonb)
RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  dia jsonb;
  v_batidas jsonb;
  v_extra jsonb;
  v_abono boolean;
begin
  if p_competencia <> date_trunc('month', p_competencia)::date then
    raise exception 'competencia deve ser o primeiro dia do mes';
  end if;

  insert into public.rh_cartoes_iniciados (empregado_id, competencia)
  values (p_empregado_id, p_competencia)
  on conflict do nothing;

  for dia in select * from jsonb_array_elements(coalesce(p_dias, '[]'::jsonb)) loop
    v_batidas := coalesce(dia -> 'batidas', '[]'::jsonb);
    v_extra := case when jsonb_typeof(dia -> 'extra') = 'object' then dia -> 'extra' else null end;
    v_abono := coalesce((dia ->> 'abono')::boolean, false);

    continue when jsonb_array_length(v_batidas) = 0 and v_extra is null and not v_abono;

    insert into public.rh_ponto_dias (empregado_id, data, batidas, extra, abono)
    values (p_empregado_id, (dia ->> 'data')::date, v_batidas, v_extra, v_abono)
    on conflict (empregado_id, data) do nothing;
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.rh_gravar_cartao(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_gravar_cartao(uuid, date, jsonb) TO authenticated, service_role;

CREATE FUNCTION public.rh_abonar_dias(p_empregado_id uuid, p_datas jsonb)
RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  v_data jsonb;
begin
  for v_data in select * from jsonb_array_elements(coalesce(p_datas, '[]'::jsonb)) loop
    insert into public.rh_ponto_dias (empregado_id, data, batidas, extra, abono)
    values (p_empregado_id, (v_data #>> '{}')::date, '[]'::jsonb, null, true)
    on conflict (empregado_id, data) do update set abono = true;
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.rh_abonar_dias(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_abonar_dias(uuid, jsonb) TO authenticated, service_role;

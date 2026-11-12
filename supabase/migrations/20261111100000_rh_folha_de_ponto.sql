-- Folha de ponto do RH: o Quadro de funcionários do Cliente (nome, Jornada por dia da semana e a marca
-- "comissionado"), o Cartão de ponto digitado (batidas, coluna Extra e Abono por dia) e o "sem movimento no
-- mês". Nenhum outro dado do empregado é guardado: sem documento, sem motivo médico, sem imagem. A
-- Totalização é calculada no código a partir disto, nunca gravada. Leem o Admin, o Líder do RH e o
-- Responsável do RH do Cliente; escreve só o Responsável (Funcionário do RH), como o acompanhamento mensal.
-- Cada escrita é auditada na mesma transação (gatilho).

-- Padrão do Cliente: "os empregados deste Cliente são comissionados" (a marca de cada empregado nasce dele).
CREATE TABLE public.rh_ponto_padroes (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    comissionados boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_ponto_padroes_pkey PRIMARY KEY (cliente_id)
);

CREATE TABLE public.rh_empregados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nome text NOT NULL,
    -- Carga em minutos por dia da semana, de domingo (1) a sábado (7); zero = não trabalha nesse dia.
    jornada smallint[] NOT NULL,
    comissionado boolean DEFAULT false NOT NULL,
    -- Inativar tira o empregado do quadro sem apagar os cartões já feitos.
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT rh_empregados_pkey PRIMARY KEY (id),
    CONSTRAINT rh_empregados_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 120),
    -- array_position: elemento NULL daria NULL no BETWEEN, e NULL passaria no CHECK.
    CONSTRAINT rh_empregados_jornada_check CHECK (
        array_length(jornada, 1) = 7
        AND array_position(jornada, NULL) IS NULL
        AND jornada[1] BETWEEN 0 AND 1440 AND jornada[2] BETWEEN 0 AND 1440 AND jornada[3] BETWEEN 0 AND 1440
        AND jornada[4] BETWEEN 0 AND 1440 AND jornada[5] BETWEEN 0 AND 1440 AND jornada[6] BETWEEN 0 AND 1440
        AND jornada[7] BETWEEN 0 AND 1440
    )
);
CREATE INDEX rh_empregados_cliente_idx ON public.rh_empregados (cliente_id);

-- Pares de batida: lista de até p_maximo objetos {"entrada": min, "saida": min} com minutos de 0 a 1439.
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
    -- Coluna Extra do cartão: um par, ou nenhum.
    extra jsonb,
    -- Só a sinalização: nunca o motivo, o CID nem o documento.
    abono boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_ponto_dias_pkey PRIMARY KEY (empregado_id, data),
    CONSTRAINT rh_ponto_dias_batidas_check CHECK (public.rh_pares_de_batida_validos(batidas, 4)),
    CONSTRAINT rh_ponto_dias_extra_check CHECK (
        extra IS NULL OR public.rh_pares_de_batida_validos(jsonb_build_array(extra), 1)
    )
);

CREATE TABLE public.rh_empregado_sem_movimento (
    empregado_id uuid NOT NULL REFERENCES public.rh_empregados(id) ON DELETE CASCADE,
    -- Primeiro dia do mês (férias, desligamento): o empregado não trava o Holerite desse mês.
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

-- Regras de dado que a RLS não expressa: o empregado não troca de Cliente; o dia de ponto não troca de data nem de empregado; cartão só de empregado ativo.
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

-- Auditoria do sucesso, na mesma transação da escrita (o ator é quem chama pela Data API). O alvo leva o CNPJ
-- e o nome do empregado, que já estão no quadro; nunca as batidas.
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

-- Grants explícitos: o anon não recebe nada; o authenticated só o que as políticas usam (o empregado nunca é
-- apagado: inativa-se).
REVOKE ALL ON TABLE public.rh_ponto_padroes, public.rh_empregados, public.rh_ponto_dias,
    public.rh_empregado_sem_movimento FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_ponto_padroes, public.rh_empregados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rh_ponto_dias TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rh_empregado_sem_movimento TO authenticated;
GRANT ALL ON TABLE public.rh_ponto_padroes, public.rh_empregados, public.rh_ponto_dias,
    public.rh_empregado_sem_movimento TO service_role;

-- O RH lê os feriados (só leitura; cadastrar e apagar seguem do Admin) para a Totalização.
CREATE POLICY feriados_select_rh ON public.feriados FOR SELECT TO authenticated USING (
    public.acesso_liberado() AND public.meu_setor() = 'rh');

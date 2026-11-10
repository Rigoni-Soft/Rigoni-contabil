-- Acompanhamento mensal do RH: serviços do setor (lista mantida pelo Líder), "se aplica" por Cliente e
-- Serviço, e marcação de concluído por Cliente, Serviço e competência. Todo mês nasce pendente (a ausência de
-- linha é pendente). Só o Responsável do RH do Cliente marca; o Líder do RH e o Admin leem. Cada escrita é
-- auditada na mesma transação (gatilho), como o Responsável.

CREATE TABLE public.rh_servicos_acompanhamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    -- Posição da coluna na tabela do RH: a ordem em que os serviços foram cadastrados.
    ordem bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    -- Serviço do sistema (Holerite): derivado, nunca marcado nem editado à mão.
    sistema boolean DEFAULT false NOT NULL,
    -- Primeiro mês (dia 1) em que o serviço aparece; os anteriores nunca o mostram.
    ativo_desde date NOT NULL,
    -- Desativar tira o serviço dos meses a partir deste mês e preserva os anteriores.
    desativado_em timestamp with time zone,
    CONSTRAINT rh_servicos_acompanhamento_pkey PRIMARY KEY (id),
    CONSTRAINT rh_servicos_acompanhamento_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 40),
    CONSTRAINT rh_servicos_acompanhamento_mes_check CHECK (ativo_desde = date_trunc('month', ativo_desde)::date)
);
CREATE UNIQUE INDEX rh_servicos_acompanhamento_nome_ativo_idx
    ON public.rh_servicos_acompanhamento (lower(btrim(nome))) WHERE desativado_em IS NULL;

CREATE TABLE public.rh_cliente_servico_aplica (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    servico_id uuid NOT NULL REFERENCES public.rh_servicos_acompanhamento(id) ON DELETE CASCADE,
    -- Sem linha, o serviço se aplica; a linha existe para registrar o "não se aplica" (e a volta).
    aplica boolean NOT NULL,
    CONSTRAINT rh_cliente_servico_aplica_pkey PRIMARY KEY (cliente_id, servico_id)
);

CREATE TABLE public.rh_acompanhamento_marcacoes (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    servico_id uuid NOT NULL REFERENCES public.rh_servicos_acompanhamento(id) ON DELETE CASCADE,
    -- Primeiro dia do mês da competência. A linha existe = concluído; desmarcar apaga a linha.
    competencia date NOT NULL,
    marcado_por uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    marcado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_acompanhamento_marcacoes_pkey PRIMARY KEY (cliente_id, servico_id, competencia),
    CONSTRAINT rh_acompanhamento_marcacoes_mes_check CHECK (competencia = date_trunc('month', competencia)::date)
);
CREATE INDEX rh_acompanhamento_marcacoes_competencia_idx ON public.rh_acompanhamento_marcacoes (competencia);

-- Os serviços de partida do RH, visíveis desde sempre, e o Holerite (do sistema).
INSERT INTO public.rh_servicos_acompanhamento (nome, ativo_desde, sistema) VALUES
    ('FGTS', '2000-01-01', false),
    ('DCTFWeb', '2000-01-01', false),
    ('NUTRI', '2000-01-01', false),
    ('SIB', '2000-01-01', false),
    ('Sindicato', '2000-01-01', false),
    ('Holerite', '2000-01-01', true);

-- Quem lê o acompanhamento do Cliente: o Admin, o Líder do RH e o Responsável do RH dele.
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

-- Quem marca: só o Funcionário do RH que é Responsável do Cliente.
CREATE FUNCTION public.sou_responsavel_rh_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado()
     and public.meu_papel() = 'funcionario' and public.meu_setor() = 'rh'
     and public.sou_responsavel_do_cliente_no_setor(p_cliente_id, 'rh');
$$;

-- O serviço está na tabela do mês: já criado e ainda não desativado (a desativação vale do mês dela em diante).
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

-- Serviço editável à mão: não é o do sistema.
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

-- Regras de dado que a RLS não expressa: só nome e desativação mudam; desativado não volta; marcação só em
-- serviço de marcar à mão, ativo no mês e que não seja futuro; "se aplica" só em serviço editável.
CREATE FUNCTION public.proteger_servico_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    -- Quem cadastra pela API começa neste mês e ativo; só o servidor (service_role) escolhe diferente.
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
  -- Serviço desativado é histórico: nenhum UPDATE (nem renomear) o altera.
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

-- Auditoria do sucesso, na mesma transação da escrita (o ator é quem chama pela Data API).
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
      -- coalesce: no DELETE em cascata (Cliente ou serviço apagado) a linha pai já não existe e o alvo é NOT NULL.
      v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = v_cliente), '?')
        || ' ' || coalesce((select s.nome from public.rh_servicos_acompanhamento s where s.id = v_servico), '?');
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
CREATE TRIGGER rh_acompanhamento_marcacoes_auditar AFTER INSERT OR DELETE ON public.rh_acompanhamento_marcacoes
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_acompanhamento();

ALTER TABLE public.rh_servicos_acompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_cliente_servico_aplica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_acompanhamento_marcacoes ENABLE ROW LEVEL SECURITY;

-- Serviços: o RH inteiro e o Admin leem; só o Líder do RH cadastra, renomeia e desativa (os do sistema não).
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

-- "Se aplica" e marcação: leem o Admin, o Líder do RH e o Responsável; escreve só o Responsável do RH.
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

-- Grants explícitos: o anon não recebe nada; o authenticated só o que as políticas usam.
REVOKE ALL ON TABLE public.rh_servicos_acompanhamento, public.rh_cliente_servico_aplica,
    public.rh_acompanhamento_marcacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_servicos_acompanhamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rh_cliente_servico_aplica TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rh_acompanhamento_marcacoes TO authenticated;
GRANT ALL ON TABLE public.rh_servicos_acompanhamento, public.rh_cliente_servico_aplica,
    public.rh_acompanhamento_marcacoes TO service_role;

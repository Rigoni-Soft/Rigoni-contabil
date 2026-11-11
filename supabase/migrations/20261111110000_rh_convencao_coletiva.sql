-- Convenção coletiva do Cliente (RH): o PDF no bucket privado, a vigência, o sindicato que a identifica e o
-- conjunto de regras extraído no upload (jsonb versionado: aplicadas com a cláusula, rejeitadas com o
-- motivo). A convenção nunca é editada nem apagada: renovar é subir outra; as anteriores ficam no histórico
-- e valem para os períodos da época. Um Cliente pode ter mais de uma (sindicatos diferentes); o empregado
-- aponta a sua pelo sindicato, e sem ponteiro vale a única do Cliente. Sobe o Líder do RH ou o Admin;
-- leem o Admin, o Líder do RH e o Responsável do RH do Cliente. As policies do bucket estão na migration seguinte.

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
    CONSTRAINT rh_convencoes_arquivo_nome_check CHECK (char_length(btrim(arquivo_nome)) BETWEEN 1 AND 255),
    -- coalesce: chave ausente dá NULL, e NULL passaria no CHECK.
    CONSTRAINT rh_convencoes_regras_check CHECK (
        coalesce(
            jsonb_typeof(regras) = 'object'
            AND jsonb_typeof(regras -> 'versao') = 'number'
            AND jsonb_typeof(regras -> 'aplicadas') = 'array'
            AND jsonb_typeof(regras -> 'rejeitadas') = 'array',
            false)
    )
);
CREATE INDEX rh_convencoes_cliente_idx ON public.rh_convencoes (cliente_id, vigencia_inicio DESC);

-- Interruptores do Cliente que a convenção não decide: banco de horas (desligado) e trabalho aos domingos.
CREATE TABLE public.rh_cliente_interruptores (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    banco_de_horas boolean DEFAULT false NOT NULL,
    trabalho_aos_domingos boolean DEFAULT false NOT NULL,
    CONSTRAINT rh_cliente_interruptores_pkey PRIMARY KEY (cliente_id)
);

-- Sindicato da convenção que o empregado segue; nulo = a única convenção do Cliente.
ALTER TABLE public.rh_empregados
    ADD COLUMN convencao_sindicato text,
    ADD CONSTRAINT rh_empregados_convencao_sindicato_check CHECK (
        convencao_sindicato IS NULL OR char_length(btrim(convencao_sindicato)) BETWEEN 1 AND 120
    );

-- Quem sobe a convenção: o Admin, ou o Líder do RH.
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

-- Auditoria do sucesso, na mesma transação (o ator é quem chama pela Data API). O alvo leva o CNPJ e o
-- sindicato; nunca as regras.
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

-- Grants explícitos: o anon não recebe nada; a convenção não se altera nem se apaga.
REVOKE ALL ON TABLE public.rh_convencoes, public.rh_cliente_interruptores FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rh_convencoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rh_cliente_interruptores TO authenticated;
GRANT ALL ON TABLE public.rh_convencoes, public.rh_cliente_interruptores TO service_role;

-- O empregado só aponta para o sindicato de uma convenção que o Cliente tem; nulo sempre vale.
CREATE FUNCTION public.proteger_convencao_do_empregado_rh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.convencao_sindicato is not null
     and new.convencao_sindicato is distinct from old.convencao_sindicato
     and not exists (
       select 1 from public.rh_convencoes
       where cliente_id = new.cliente_id and sindicato = new.convencao_sindicato) then
    raise exception 'rh_convencao_inexistente';
  end if;
  return new;
end;
$$;
CREATE TRIGGER rh_empregados_convencao_proteger BEFORE UPDATE ON public.rh_empregados
    FOR EACH ROW EXECUTE FUNCTION public.proteger_convencao_do_empregado_rh();

-- Bucket privado; as policies de storage.objects vêm na migration seguinte.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('convencoes-coletivas', 'convencoes-coletivas', false, 10485760, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;

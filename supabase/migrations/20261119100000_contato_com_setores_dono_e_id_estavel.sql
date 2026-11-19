-- Contato do Cliente com e-mail, Setores, Setor dono e id estável (ADR 0013).
-- O "contato padrão" deixa de existir; a edição passa a criar, atualizar e remover por id, num caminho
-- único (`salvar_contatos_do_cliente`); a regra "o contato cujo número bate neste Cliente" vive numa só
-- função (`contato_por_telefone_no_cliente`) e a normalização do telefone numa só (`chave_telefone`).
-- Não cria Contatos nem Destinos: os Contatos que existem continuam, com o setor URA.

-- Normalização única do telefone: só dígitos e sem o DDI 55 (o número cadastrado é DDD + número).
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

-- Lista de referência dos Setores de um Contato: a URA (só rótulo, nunca destino nem Setor de usuário)
-- mais os nove Setores atuais. Fica fora do enum de login para a estrutura organizacional administrar depois.
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

-- Contato: telefone passa a ser opcional (basta um canal), ganha e-mail e Setor dono (null = o Admin).
ALTER TABLE public.cliente_contatos
    ALTER COLUMN telefone DROP NOT NULL,
    ADD COLUMN email text,
    ADD COLUMN dono_setor public.setor_slug;

-- Telefone sem nenhum dígito ("-", "()") não é WhatsApp: vira "sem telefone".
UPDATE public.cliente_contatos SET telefone = NULL WHERE public.chave_telefone(telefone) IS NULL;

-- Sobrou Contato sem telefone e sem e-mail: não há o que preservar em silêncio, a migration lista quem é.
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

-- Quem edita hoje continua editando: Clientes SN/MEI eram do SN, os demais só o RH gravava.
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

-- Setores de um Contato (a URA em todos).
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

-- Os Contatos que já existem ficam só com a URA (o dono continua em `dono_setor`; só os Contatos novos
-- ganham também o dono em `cliente_contato_setores`).
INSERT INTO public.cliente_contato_setores (contato_id, setor)
SELECT id, 'ura' FROM public.cliente_contatos;

-- O mesmo número (normalizado) no mesmo Cliente vira um Contato só: fica o mais antigo e ganha os Setores
-- dos repetidos (o repetido era de outro Setor que usava o mesmo número). Sem gatilhos: é correção de dados.
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

-- O mesmo WhatsApp (normalizado) ou e-mail não vira dois Contatos no Cliente; entre Clientes pode repetir.
CREATE UNIQUE INDEX cliente_contatos_telefone_unico_no_cliente
    ON public.cliente_contatos (cliente_id, public.chave_telefone(telefone))
    WHERE public.chave_telefone(telefone) IS NOT NULL;
CREATE UNIQUE INDEX cliente_contatos_email_unico_no_cliente
    ON public.cliente_contatos (cliente_id, email)
    WHERE email IS NOT NULL;

-- Todo Contato nasce com a URA e com o Setor dono (quando não é o Admin).
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

-- Normaliza e recusa duplicidade no Cliente apontando o Contato existente (o id vai no HINT).
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
    -- O dono só muda pela exclusão do dono que outro Setor ainda usa (`contato_exclusao_em_uso`): vira da URA.
    if new.dono_setor is distinct from old.dono_setor
       and not (new.dono_setor is null and current_setting('app.contato_herdado_pela_ura', true) = old.id::text) then
      raise exception 'O Setor dono do contato não pode ser trocado.' using errcode = '23514';
    end if;
  end if;
  new.nome := btrim(new.nome);
  new.telefone := nullif(btrim(coalesce(new.telefone, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');

  -- WhatsApp sem DDD é recusado; o que já estava gravado só é cobrado quando o número é trocado.
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

-- O Contato vale para qualquer Regime (o RH grava os do Cliente que não é SN): sai a trava de Regime do cadastro SN.
DROP TRIGGER cliente_contatos_proteger ON public.cliente_contatos;
DROP TRIGGER cliente_contatos_auditar ON public.cliente_contatos;
CREATE TRIGGER cliente_contatos_auditar AFTER INSERT OR UPDATE OR DELETE ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Quem edita nome, WhatsApp e e-mail: o dono (Líder do Setor e Responsável do Cliente no Setor) e o Admin.
-- Contato do Admin (dono nulo) só o Admin edita.
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

-- O dono de um Contato novo é o Setor de quem cria; o Admin não tem Setor dono.
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

-- Caminho único de salvar os Contatos de um Cliente (SN, RH e Admin): cria, atualiza e remove por id.
-- O que é de outro Setor volta inalterado (sem erro); alterar ou remover o de outro Setor é recusado.
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

-- A validação e a gravação de UM contato, uma só para o lote e para o "Salvar" da linha: cria ou atualiza
-- por id; alterar o de outro Setor é recusado, e o que veio inalterado passa sem exigir o dono.
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

  -- Remove primeiro: quem sai libera o número para quem entra.
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

  -- Limite: trocar os números entre dois contatos do mesmo lote (A fica com o de B e vice-versa) dá
  -- duplicidade, porque só quem sai da lista libera o número; a troca se faz em duas etapas (um contato libera o número antes).
  for v_item in select * from jsonb_array_elements(p_contatos) loop
    perform public.contato_gravar(p_cliente_id, v_item);
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_contatos_do_cliente(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_contatos_do_cliente(uuid, jsonb) TO authenticated, service_role;

-- A edição do SN e a do RH passam pelo caminho único.
CREATE OR REPLACE FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- sem primeiro acesso finalizado a barreira é a RLS (erro de permissão), não esta mensagem
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

CREATE OR REPLACE FUNCTION public.editar_cadastro_rh_cliente(p_cliente_id uuid, p_observacoes text, p_contatos jsonb DEFAULT NULL) RETURNS void
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

  -- Os contatos já geram a auditoria pelo gatilho; a edição só de observações também precisa de registro.
  if current_setting('app.cliente_auditado', true) is distinct from p_cliente_id::text then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.editar-operacional',
      (select cnpj from public.clientes where id = p_cliente_id), 'sucesso', now()
    );
  end if;
end;
$$;

-- A regra "o contato cujo número bate neste Cliente": um ponto só, usado pela URA, pelo painel, pela fila
-- e pela abertura do atendimento. O número é único no Cliente, então não há desempate. Roda com os
-- direitos de quem chama (a RLS decide quais Contatos aparecem).
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

-- URA: o Cliente de um número em todos os Contatos de todos os Clientes, qualquer que seja o Setor dono.
-- Uma linha por Cliente; mais de uma linha é número ambíguo (a Recepção atende, sem documento).
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

-- Provisório até o envio ler os Destinos: sem "padrão", o envio usa o Contato mais antigo com WhatsApp.
CREATE OR REPLACE FUNCTION public.clientes_para_envio_base() RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.id, c.empresa, c.email, o.forma_envio, o.documento_obrigatorio, o.das_status,
         o.data_envio_das, ct.nome, ct.telefone_envio,
         (select max(m.criado_em)
            from public.mensagens m
            join public.atendimentos a on a.id = m.atendimento_id
           where a.chave_telefone = ct.chave_nacional and m.autor = 'contato')
  from public.cliente_cadastro_operacional_sn o
  join public.clientes c on c.id = o.cliente_id
  left join lateral (
    select p.nome, public.chave_telefone(p.telefone) as chave_nacional,
           case when length(public.chave_telefone(p.telefone)) in (10, 11)
                then '55' || public.chave_telefone(p.telefone)
                else regexp_replace(p.telefone, '\D', '', 'g') end as telefone_envio
    from public.cliente_contatos p
    where p.cliente_id = c.id and public.chave_telefone(p.telefone) is not null
    order by p.criado_em, p.id
    limit 1
  ) ct on true;
$$;

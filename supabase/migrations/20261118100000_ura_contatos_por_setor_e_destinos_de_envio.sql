-- A URA ganha a etapa "setor": ao pedir um atendente, o cliente escolhe o setor numa lista paginada.
-- A sessão guarda só a posição (etapa, página e respostas inválidas), como nas outras etapas.
-- O trio modo/pagina/lista continua exclusivo da etapa "alteracao"; a página passa a existir também em "setor".

ALTER TABLE public.atendimento_sessoes DROP CONSTRAINT atendimento_sessoes_etapa_check;
ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_etapa_check
    CHECK (etapa = ANY (ARRAY['tipo_documento'::text, 'alteracao'::text, 'ja_cliente'::text, 'cnpj'::text, 'cnpj_nova_tentativa'::text, 'setor'::text]));

ALTER TABLE public.atendimento_sessoes DROP CONSTRAINT atendimento_sessoes_check;
ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_check
    CHECK (((etapa = 'alteracao'::text) = (modo IS NOT NULL)) AND ((etapa = 'alteracao'::text) = (lista IS NOT NULL)));

ALTER TABLE public.atendimento_sessoes ADD CONSTRAINT atendimento_sessoes_pagina_etapa_check
    CHECK ((etapa = ANY (ARRAY['alteracao'::text, 'setor'::text])) = (pagina IS NOT NULL));

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

REVOKE ALL ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) TO authenticated, service_role;

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

-- Destinos de envio por Setor (ADR 0013): (Cliente, Setor, Tipo de envio, Contato, canal) e a resolução
-- "quem recebe este envio" no banco. O tipo nulo é "todos os envios do Setor" (o padrão); um tipo do
-- catálogo vale para aquele tipo e, sem ele, valem os "todos". O canal é do Destino e sempre gravado
-- explícito (WhatsApp, e-mail ou os dois). A migration não cria Destinos: o SN começa sem nenhum.

-- Catálogo fixo dos tipos de envio que o sistema faz hoje (FGTS e folha para assinar entram quando existirem).
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

-- Quais tipos cada Setor envia.
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

-- O Destino aponta o Contato do mesmo Cliente (chave composta).
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
    -- Tipo nulo ("todos") não passa pela checagem; um tipo precisa existir para o Setor.
    CONSTRAINT destinos_de_envio_tipo_fkey FOREIGN KEY (setor, tipo)
        REFERENCES public.tipos_de_envio_do_setor(setor, tipo)
);
CREATE UNIQUE INDEX destinos_de_envio_unico
    ON public.destinos_de_envio (cliente_id, setor, COALESCE(tipo, ''), contato_id);
CREATE INDEX destinos_de_envio_contato_idx ON public.destinos_de_envio (contato_id);

-- O canal gravado precisa existir no Contato na hora de gravar.
CREATE FUNCTION public.destino_validar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_contato public.cliente_contatos;
begin
  -- DEFINER lê fora da RLS: só o contato do próprio Cliente do destino; o de outro Cliente (ou
  -- inexistente) cai na FK composta, sem revelar o nome.
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

-- Os Setores do Contato são os que o usam: usar entra, deixar de usar sai (o dono e a URA ficam).
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

-- Excluir o Contato pelo Setor dono, com outro Setor ainda o usando como Destino: ele não é apagado. Passa
-- a ser da URA (sem dono: só o Admin o edita) e segue disponível aos Setores que o escolheram; os Destinos
-- do ex-dono saem. Sem uso de outro Setor, o Contato cai com os Destinos do dono. Contato da URA (ou do Admin)
-- em uso por algum Setor não se exclui: não há quem o herde.
CREATE FUNCTION public.contato_exclusao_em_uso() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_setores text;
begin
  -- Apagar o Cliente leva os Contatos em cascata: aí não há o que decidir.
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
  -- Cancela a exclusão: o Contato fica, agora da URA.
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

-- Cada Setor lê e grava só os seus Destinos (Líder do Setor, Responsável do Cliente no Setor e Admin).
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

-- Quem recebe este envio: os Destinos do Setor para o tipo e, sem nenhum para o tipo, os "todos". Um tipo
-- pode ter vários Contatos. `valido` é falso quando o canal gravado no Destino sumiu do Contato
-- (`motivo` diz qual); quem consome entrega só os válidos e reporta os inválidos. O tipo (específico ou
-- "todos") é escolhido antes; `p_canal` só filtra depois, então um tipo definido só por e-mail não deixa
-- os "todos" entrarem numa consulta de WhatsApp. `telefone_envio` já vem com o DDI 55.
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

-- Salva UM contato do Cliente (cria ou atualiza por id), sem tocar nos outros contatos: é o "Salvar"
-- da linha do formulário. A validação é a mesma do lote (`contato_gravar`).
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

-- Define o que UM Contato recebe do Setor de quem chama (ADR 0013): a lista de tipos de envio do catálogo
-- do Setor, ou 'todos' (os "todos os envios do Setor", o tipo nulo do Destino). O canal vem do próprio
-- Contato: um canal só, esse; os dois, WhatsApp e e-mail. Tipos fora da lista saem, os novos entram e o
-- canal dos que ficam acompanha o Contato. O Setor vem do perfil, nunca do chamador; permissão e tipo
-- válido são da RLS e das chaves. O Admin não tem Setor: não define Destinos.

-- O contato com os dois canais (WhatsApp e e-mail) escolhe por qual canal o Setor lhe envia: a função
-- que define o que o Contato recebe passa a receber o canal. Com um canal só, o canal é o do Contato e o
-- p_canal é ignorado; com os dois, o p_canal é obrigatório e precisa caber no que o Contato tem.
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
  -- A RLS já barra o insert; sem esta conferência, quem não gere o Cliente chamando com a lista vazia (ou igual à
  -- gravada) veria sucesso em delete/update que não afetam linha nenhuma.
  if not public.pode_gerir_parcelamento(p_cliente_id, v_setor) then
    raise exception 'Sem permissão para definir os Destinos de envio deste Cliente.' using errcode = '42501';
  end if;
  -- Quem mexe nos Destinos de um contato espera quem já mexe: duas chamadas ao mesmo contato (duplo clique,
  -- Salvar junto com um checkbox) passariam juntas no `insert ... where not exists` e a segunda violaria
  -- destinos_de_envio_unico. O lock vem antes de ler o contato: o canal sai do que o contato tem agora, não
  -- do que tinha quando a espera começou.
  perform pg_advisory_xact_lock(hashtext('definir_tipos_de_envio_do_contato:' || p_contato_id::text));

  select * into v_contato from public.cliente_contatos
  where id = p_contato_id and cliente_id = p_cliente_id;
  if not found then
    raise exception 'O contato não pertence a este Cliente.' using errcode = '22023';
  end if;

  v_tem_whatsapp := public.chave_telefone(v_contato.telefone) is not null;
  v_tem_email := v_contato.email is not null;
  -- 'todos' é o tipo nulo do Destino.
  -- Elemento nulo na lista (chamada direta) faria o `<> all` virar nulo e nada sair: fica de fora.
  v_tipos := array(select distinct t from unnest(coalesce(p_tipos, '{}')) as t where t is not null);
  -- O catálogo de tipos é curto: o limite barra o array enorme de quem chama a função direto.
  if cardinality(v_tipos) > 12 then
    raise exception 'Tipos de envio demais para um contato.' using errcode = '22023';
  end if;

  -- Com os dois canais qualquer canal escolhido cabe no contato; com um só, o p_canal é ignorado.
  if v_tem_whatsapp and v_tem_email then
    -- Sem tipo marcado não há envio, então não há canal a escolher (é o caso de deixar de usar o contato).
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
    -- cliente_contatos_canal_check garante WhatsApp válido ou e-mail: sem WhatsApp, o canal é o e-mail.
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

-- Os envios automáticos (lembrete de documento, DAS e guias de parcelamento) passam a ler os Destinos de
-- envio do Setor (ADR 0013) em vez do Contato mais antigo e da forma de envio do Cliente. As leituras
-- dos jobs deixam de devolver contato, e-mail e forma de envio: quem recebe vem de
-- `destinos_de_envio_do_job`, que é `destinos_de_envio_resolvidos` com a janela de 24h de cada telefone.

-- A forma de envio do cadastro e o contato "provisório" saem das leituras dos jobs.
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

-- O baseline concede EXECUTE a authenticated por default privileges: o REVOKE de PUBLIC não basta, e
-- estas funções são só do job (service_role).
REVOKE ALL ON FUNCTION public.clientes_para_envio_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.clientes_para_envio_base() TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) TO service_role;

-- Quem recebe o envio (os válidos e os inválidos, com o `motivo`: quem consome entrega os válidos e
-- reporta os inválidos), com o telefone já com o DDI e a última Mensagem que o
-- Contato mandou em qualquer Atendimento do telefone (abre e fecha a janela de 24h).
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

-- A última Mensagem do Contato olha os Atendimentos do telefone em qualquer status; o único índice da
-- chave é parcial (em andamento), então sem este cada Destino lido varreria `atendimentos`.
CREATE INDEX atendimentos_chave_telefone ON public.atendimentos USING btree (chave_telefone);

-- O aviso do sino leva o texto do alerta que o gerou (o de "novo cliente" e o de "nova alteração" montam o
-- texto no cliente a partir do tipo).
ALTER TABLE public.avisos_cadastro ADD COLUMN mensagem text;

-- Um alerta `contato_ausente` que se ABRE (inserção: renovar o que já está aberto é um UPDATE e não
-- avisa de novo) avisa no sino o Líder do Setor e o Responsável do Cliente naquele Setor; sem
-- Responsável ativo, só o Líder. O Admin nunca é destinatário. Resolvido e reaberto, é uma nova
-- inserção e um novo aviso.
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

-- Os `contato_ausente` já abertos (renovados por UPDATE, nunca por inserção) avisam uma vez agora, com o
-- texto que têm; depois disso só um alerta novo avisa.
SELECT public.avisar_sem_meio_de_envio(a.cliente_id, a.setor, a.mensagem)
  FROM public.alertas_setor a
 WHERE a.tipo = 'contato_ausente' AND a.resolvido_em IS NULL;

-- A Recepção cadastra, no atendimento aberto pela URA, o número que a URA não achou como Contato do
-- Cliente confirmado (ADR 0013). A permissão é só esta: criar UM Contato do Cliente, com o WhatsApp do
-- atendimento, setor URA e a Recepção como dona. Não altera Contato nem Destino de outro Setor.
--
-- Quem chama: Funcionário ou Líder da Recepção que é o dono do atendimento em andamento (é quem
-- responde o cliente). O dono é conferido aqui e não nas políticas da tabela, porque a Recepção não
-- gerencia contatos em geral (`pode_gerir_contato`).
--
-- Devolve o resultado em vez de lançar erro quando o número já tem Contato, para a tela mostrar o existente:
--   criado | existente (o número já é Contato deste Cliente) | em_outro_cliente | email_em_uso
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

  -- Atendimento já ligado a um Cliente só cadastra contato nesse Cliente; o Atendimento sem Cliente (o caso
  -- da URA que não achou o número) aceita o Cliente que a Recepção confirmou.
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

  -- O número já é Contato deste Cliente: mostra o existente, não duplica.
  select * into v_existente from public.cliente_contatos
   where cliente_id = p_cliente_id and public.chave_telefone(telefone) = v_chave;
  if found then
    return jsonb_build_object('status', 'existente', 'contato_id', v_existente.id, 'nome', v_existente.nome);
  end if;

  -- O número é Contato de outro Cliente: não cria (ficaria ambíguo para a URA).
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

  -- A auditoria é desta ação (abaixo): o gatilho genérico de edição do cadastro não registra de novo.
  perform set_config('app.cliente_auditado', p_cliente_id::text, true);
  begin
    insert into public.cliente_contatos (id, cliente_id, nome, telefone, email, dono_setor)
    values (v_id, p_cliente_id, v_nome, v_chave, v_email, 'recepcao');
  exception when unique_violation then
    -- Outra chamada gravou o mesmo número ou e-mail entre as checagens acima e este insert (os índices
    -- únicos do Cliente seguram): devolve o que ela criou, em vez de vazar o erro do índice.
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

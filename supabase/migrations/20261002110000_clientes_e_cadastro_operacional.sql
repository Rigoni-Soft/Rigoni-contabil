-- Clientes, contatos, Cadastro operacional do Simples Nacional e Responsável.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

CREATE TYPE public.das_status AS ENUM (
    'pendente',
    'pronto',
    'enviado',
    'sem_movimento'
);

CREATE TYPE public.documento_obrigatorio_status AS ENUM (
    'positivo',
    'negativo',
    'nao_se_aplica'
);

-- Ticket #34: Funcionário do Simples Nacional edita cadastro operacional de Cliente.
--
-- Decisão arquitetural (confirmada com o usuário): campos operacionais em
-- TABELA SEPARADA, não em `clientes`. RLS no Postgres é por linha, não por
-- coluna — se os campos entrassem em `clientes`, qualquer policy de UPDATE
-- que liberasse o Funcionário SN liberaria a linha inteira, incluindo
-- contrato_social_caminho (dado jurídico, só Admin deve tocar).
CREATE TYPE public.forma_envio AS ENUM (
    'whatsapp',
    'email',
    'whatsapp_e_email'
);

CREATE TYPE public.parcelamento_status AS ENUM (
    'pendente',
    'enviado',
    'interno'
);

-- Ticket #33: Cadastro de Cliente pelo Admin.
CREATE TYPE public.regime AS ENUM (
    'simples_nacional',
    'lucro_presumido',
    'lucro_real',
    'mei'
);

CREATE TABLE public.clientes (
    id uuid NOT NULL,
    empresa text NOT NULL,
    cnpj text NOT NULL,
    regime public.regime NOT NULL,
    contrato_social_caminho text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    CONSTRAINT clientes_email_check CHECK (((email IS NULL) OR ((length(email) <= 254) AND (email ~ '^[^@\s]+@[^@\s]+$'::text))))
);

CREATE TABLE public.cliente_alteracoes_contratuais (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    data date NOT NULL,
    arquivo_caminho text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cliente_cadastro_operacional_sn (
    cliente_id uuid NOT NULL,
    forma_envio public.forma_envio DEFAULT 'whatsapp'::public.forma_envio NOT NULL,
    documento_obrigatorio public.documento_obrigatorio_status,
    das_status public.das_status,
    data_envio_das date,
    tem_parcelamento boolean DEFAULT false NOT NULL,
    parcelamento_status public.parcelamento_status,
    observacoes_gerais text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    responsavel_id uuid
);

CREATE TABLE public.cliente_contatos (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text NOT NULL,
    padrao boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cliente_atividades_mensais (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    ano_mes date NOT NULL,
    industria boolean DEFAULT false NOT NULL,
    comercio boolean DEFAULT false NOT NULL,
    servico boolean DEFAULT false NOT NULL,
    CONSTRAINT cliente_atividades_mensais_ano_mes_check CHECK ((EXTRACT(day FROM ano_mes) = (1)::numeric))
);

ALTER TABLE ONLY public.cliente_alteracoes_contratuais
    ADD CONSTRAINT cliente_alteracoes_contratuais_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_cliente_id_ano_mes_key UNIQUE (cliente_id, ano_mes);

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_pkey PRIMARY KEY (cliente_id);

ALTER TABLE ONLY public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_cnpj_key UNIQUE (cnpj);

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cliente_alteracoes_contratuais
    ADD CONSTRAINT cliente_alteracoes_contratuais_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.perfis(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Devolutiva técnica PR #69: o índice parcial acima só cobre o contato padrão;
-- leitura e o delete-then-insert da RPC varrem todos os contatos do Cliente.
CREATE INDEX cliente_contatos_cliente_id_idx ON public.cliente_contatos USING btree (cliente_id);

-- Garante no máximo 1 contato padrão por Cliente. Índice parcial, não CHECK
-- — CHECK não enxerga outras linhas da mesma tabela.
CREATE UNIQUE INDEX cliente_contatos_um_padrao_por_cliente ON public.cliente_contatos USING btree (cliente_id) WHERE padrao;

-- Devolutiva técnica PR #69, ponto 3 + revalidação (B2): a auditoria de sucesso nasce na mesma
-- transação de QUALQUER escrita autorizada nas três tabelas (RPC ou Data API direta), e se o
-- evento não puder ser gravado a escrita inteira é desfeita — não existe alteração sem
-- `cliente.editar-operacional`. Uma transação gera um só evento por Cliente: o gatilho marca o
-- Cliente já auditado numa variável local da transação (a edição completa da RPC toca as três
-- tabelas e continua sendo um evento lógico; o cadastro de Cliente marca o mesmo em
-- `auditar_cliente_criado`, então a linha operacional automática não duplica `cliente.criar`).
-- Atribuir o Responsável (`responsavel_id`, #65) não dispara: tem a própria ação.
-- Ator e setor vêm da sessão do banco, nunca do chamador. `registrar_acao_auditoria` é só
-- service_role (PR #61), por isso o gatilho (definer) insere direto.
CREATE FUNCTION public.auditar_cadastro_operacional_editado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null
     or current_setting('app.cliente_auditado', true) = v_cliente_id::text then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.editar-operacional',
    (select cnpj from public.clientes where id = v_cliente_id), 'sucesso', now()
  );
  perform set_config('app.cliente_auditado', v_cliente_id::text, true);
  return null;
end;
$$;

-- Redefine o gatilho do #33 só para marcar o Cliente recém-criado como auditado nesta transação.
CREATE FUNCTION public.auditar_cliente_criado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.criar', new.cnpj, 'sucesso', now());
    perform set_config('app.cliente_auditado', new.id::text, true);
  end if;
  return new;
end;
$$;

-- Devolutiva técnica PR #71, ponto 1: a auditoria de sucesso do Responsável nasce na mesma
-- transação da escrita, seja pelo caso de uso ou pela Data API (a RLS deixa o Líder do SN
-- atualizar a coluna direto). Se o evento não puder ser gravado, a alteração é desfeita. A ação
-- sai da comparação OLD/NEW (atribuir, trocar ou remover); ator e setor vêm da sessão do banco,
-- nunca do chamador. Sem auth.uid() (service_role, migrations, ON DELETE SET NULL de uma conta
-- excluída) não há ator a registrar. O gatilho de edição do cadastro operacional não dispara por
-- esta coluna, então a atribuição gera exatamente um evento.
CREATE FUNCTION public.auditar_responsavel_cliente() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_antigo uuid := case when tg_op = 'UPDATE' then old.responsavel_id end;
begin
  if auth.uid() is null or new.responsavel_id is not distinct from v_antigo then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(),
    case
      when new.responsavel_id is null then 'cliente.remover-responsavel'
      when v_antigo is null then 'cliente.atribuir-responsavel'
      else 'cliente.trocar-responsavel'
    end,
    (select cnpj from public.clientes where id = new.cliente_id), 'sucesso', now()
  );
  return null;
end;
$$;

-- Feedback de teste manual do #34: ao cadastrar um Cliente com Regime MEI ou
-- Simples Nacional, já cria a linha em cliente_cadastro_operacional_sn junto
-- (em vez de só nascer no primeiro upsert do #34) — a tela de edição/consulta
-- passa a mostrar valores explícitos em vez de tudo "não definido" desde o
-- primeiro acesso. Atributos como opção negativa/pendente (decisão de
-- produto, revisão manual em 2026-09-30): documento_obrigatorio='negativo',
-- das_status/parcelamento_status='pendente' (mesmo enum tem essa opção nos
-- dois), forma_envio mantém o default 'whatsapp' da tabela (sem opção
-- negativa aplicável). Outros Regimes (Lucro Presumido/Real) não têm cadastro
-- SN — não se aplica.
CREATE FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.clientes (id, empresa, cnpj, regime, contrato_social_caminho, email)
  values (p_id, p_empresa, p_cnpj, p_regime, p_contrato_social_caminho, p_email);

  insert into public.cliente_alteracoes_contratuais (id, cliente_id, data, arquivo_caminho)
  select
    (item ->> 'id')::uuid,
    p_id,
    (item ->> 'data')::date,
    item ->> 'arquivoCaminho'
  from jsonb_array_elements(p_alteracoes) as item;

  if p_regime in ('mei', 'simples_nacional') then
    insert into public.cliente_cadastro_operacional_sn
      (cliente_id, forma_envio, documento_obrigatorio, das_status, tem_parcelamento,
       parcelamento_status, observacoes_gerais)
    values
      (p_id, 'whatsapp', 'negativo', 'pendente', false, 'pendente', '');
  end if;
end;
$$;

-- Devolutiva PR #69 (revalidação, I1): o mês corrente é decidido pelo banco, no fuso de
-- negócio. `p_agora` existe só para testar a virada UTC x São Paulo.
CREATE FUNCTION public.mes_corrente_sp(p_agora timestamp with time zone DEFAULT now()) RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$
  select date_trunc('month', p_agora at time zone 'America/Sao_Paulo')::date;
$$;

-- Devolutiva PR #69 (revalidação, I2): Cadastro operacional SN só existe para Regime
-- Simples Nacional ou MEI (CONTEXT.md, "Regime"). Definer porque quem edita não lê `clientes`.
CREATE FUNCTION public.regime_tem_cadastro_operacional_sn(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and exists (
    select 1 from public.clientes
    where id = p_cliente_id and regime in ('simples_nacional', 'mei')
  );
$$;

-- cliente_cadastro_operacional_sn + cliente_contatos + cliente_atividades_mensais
-- são extensão do mesmo agregado Cliente (arquitetura.md seção 3.5) — uma RPC
-- transacional evita gravação parcial entre as 3 tabelas. `security invoker`:
-- as policies acima já autorizam quem chama.
-- (auditoria de sucesso: ver trigger no fim deste arquivo, ponto 3 da PR #69)
CREATE FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_tem_parcelamento boolean, p_parcelamento_status public.parcelamento_status, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) RETURNS void
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
     tem_parcelamento, parcelamento_status, observacoes_gerais, atualizado_em)
  values
    (p_cliente_id, p_forma_envio, p_documento_obrigatorio, p_das_status, p_data_envio_das,
     p_tem_parcelamento, p_parcelamento_status, p_observacoes_gerais, now())
  on conflict (cliente_id) do update set
    forma_envio = excluded.forma_envio,
    documento_obrigatorio = excluded.documento_obrigatorio,
    das_status = excluded.das_status,
    data_envio_das = excluded.data_envio_das,
    tem_parcelamento = excluded.tem_parcelamento,
    parcelamento_status = excluded.parcelamento_status,
    observacoes_gerais = excluded.observacoes_gerais,
    atualizado_em = now();

  -- Contatos: substituição total (delete-then-insert), não diff campo a
  -- campo — conjunto pequeno (padrão + poucos adicionais), sem exigência de
  -- histórico na spec.
  delete from public.cliente_contatos where cliente_id = p_cliente_id;
  insert into public.cliente_contatos (id, cliente_id, nome, telefone, padrao)
  select
    coalesce((item ->> 'id')::uuid, gen_random_uuid()),
    p_cliente_id,
    item ->> 'nome',
    item ->> 'telefone',
    (item ->> 'padrao')::boolean
  from jsonb_array_elements(p_contatos) as item;

  insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
  values (gen_random_uuid(), p_cliente_id, p_ano_mes, p_industria, p_comercio, p_servico)
  on conflict (cliente_id, ano_mes) do update set
    industria = excluded.industria,
    comercio = excluded.comercio,
    servico = excluded.servico;
end;
$$;

-- SECURITY DEFINER: as policies abaixo consultam a própria tabela
-- cliente_cadastro_operacional_sn; sem isso a policy recursaria nela mesma.
CREATE FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_cadastro_operacional_sn
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  );
$$;

CREATE FUNCTION public.pode_editar_cadastro_operacional(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and coalesce(case public.meu_papel()
    when 'admin' then true
    when 'lider_setor' then public.meu_setor() = 'simples_nacional'
    when 'funcionario' then
      public.meu_setor() = 'simples_nacional' and public.sou_responsavel_do_cliente(p_cliente_id)
    else false
  end, false);
$$;

CREATE FUNCTION public.pode_ver_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- acesso_liberado(): primeiro acesso finalizado (PR #69, ADR 0002).
  select public.acesso_liberado() and case
    when public.meu_papel() is null then false
    when public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional'
      then public.sou_responsavel_do_cliente(p_cliente_id)
    else true
  end;
$$;

-- I1 + I2 em qualquer DML de sessão (RPC ou Data API direta): Cadastro operacional só para
-- SN/MEI (inclusive Contatos, INSERT e DELETE: no DELETE o Cliente vem de OLD); Atividade só do
-- mês corrente, e a de mês passado não pode ser alterada nem movida.
-- Sem auth.uid() (service_role/migrations/seed) o chamador é o servidor confiável.
CREATE FUNCTION public.proteger_cadastro_operacional() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if not exists (
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

-- Pontos B e C: o trigger de elegibilidade passa a exigir conta ativa e a travar a
-- linha do perfil (FOR SHARE). Atribuição concorrente com promoção/desativação (que
-- seguram FOR UPDATE no perfil) espera a outra transação e reavalia o papel/estado já
-- confirmados, em vez de gravar um vínculo inválido. SECURITY DEFINER porque travar
-- linha exige privilégio de UPDATE em `perfis`, que o Líder (quem atribui) não tem.
CREATE FUNCTION public.proteger_responsavel_cliente() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.responsavel_id is null then
    return new;
  end if;

  if auth.uid() is not null
     and (public.meu_papel() is distinct from 'lider_setor'
          or public.meu_setor() is distinct from 'simples_nacional') then
    raise exception 'Só o Líder do Simples Nacional atribui o Responsável.' using errcode = '42501';
  end if;

  if new.responsavel_id is not null and not exists (
    select 1 from public.perfis
    where id = new.responsavel_id
      and papel = 'funcionario'
      and setor = 'simples_nacional'
      and desativado_em is null
    for share
  ) then
    raise exception 'O Responsável deve ser Funcionário ativo do Simples Nacional.' using errcode = '23514';
  end if;

  return new;
end;
$$;

CREATE TRIGGER cliente_atividades_auditar AFTER INSERT OR UPDATE ON public.cliente_atividades_mensais FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE TRIGGER cliente_atividades_proteger BEFORE INSERT OR UPDATE ON public.cliente_atividades_mensais FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

CREATE TRIGGER cliente_cadastro_operacional_auditar AFTER INSERT OR UPDATE OF forma_envio, documento_obrigatorio, das_status, data_envio_das, tem_parcelamento, parcelamento_status, observacoes_gerais ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE TRIGGER cliente_cadastro_operacional_auditar_responsavel AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.auditar_responsavel_cliente();

CREATE TRIGGER cliente_cadastro_operacional_proteger BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

CREATE TRIGGER cliente_cadastro_operacional_proteger_responsavel BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_responsavel_cliente();

CREATE TRIGGER cliente_contatos_auditar AFTER INSERT OR DELETE ON public.cliente_contatos FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE TRIGGER cliente_contatos_proteger BEFORE INSERT OR DELETE ON public.cliente_contatos FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

CREATE TRIGGER clientes_auditar_criacao AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_criado();

ALTER TABLE public.cliente_alteracoes_contratuais ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cliente_atividades_mensais ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cliente_cadastro_operacional_sn ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cliente_contatos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_alteracoes_insert_admin ON public.cliente_alteracoes_contratuais FOR INSERT WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

CREATE POLICY cliente_alteracoes_select_admin ON public.cliente_alteracoes_contratuais FOR SELECT USING ((public.meu_papel() = 'admin'::public.papel));

CREATE POLICY cliente_atividades_select_qualquer_perfil ON public.cliente_atividades_mensais FOR SELECT USING (public.pode_ver_cliente(cliente_id));

CREATE POLICY cliente_atividades_update_sn ON public.cliente_atividades_mensais FOR UPDATE USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_atividades_upsert_sn ON public.cliente_atividades_mensais FOR INSERT WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_cadastro_operacional_select_qualquer_perfil ON public.cliente_cadastro_operacional_sn FOR SELECT USING (public.pode_ver_cliente(cliente_id));

CREATE POLICY cliente_cadastro_operacional_update_sn ON public.cliente_cadastro_operacional_sn FOR UPDATE USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_cadastro_operacional_upsert_sn ON public.cliente_cadastro_operacional_sn FOR INSERT WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_contatos_delete_sn ON public.cliente_contatos FOR DELETE USING (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_contatos_insert_sn ON public.cliente_contatos FOR INSERT WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

CREATE POLICY cliente_contatos_select_qualquer_perfil ON public.cliente_contatos FOR SELECT USING (public.pode_ver_cliente(cliente_id));

CREATE POLICY clientes_insert_admin ON public.clientes FOR INSERT WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

CREATE POLICY clientes_select_admin ON public.clientes FOR SELECT USING ((public.meu_papel() = 'admin'::public.papel));

-- O Admin informa o e-mail ao cadastrar o Cliente; a projeção que não-Admin lê também o expõe
-- (novas colunas entram no fim da view).
CREATE VIEW public.clientes_basico WITH (security_invoker='false') AS
 SELECT id,
    empresa,
    cnpj,
    regime,
    email
   FROM public.clientes
  WHERE public.pode_ver_cliente(id);

-- A view simples é atualizável e roda com os privilégios do dono: `grant select` não remove
-- os INSERT/UPDATE/DELETE que `authenticated` recebe por default privileges do Supabase.
-- Revoga tudo antes de conceder só leitura.
revoke all on public.clientes_basico from public, anon, authenticated;
grant select on public.clientes_basico to authenticated;

-- Grants de tabela (Supabase não concede mais por default): `authenticated` só recebe o que as
-- policies deste arquivo usam (o RLS filtra as linhas); `service_role` ignora RLS e fica com tudo.
grant select, insert on table public.clientes to authenticated;
grant all on table public.clientes to service_role;
grant select, insert on table public.cliente_alteracoes_contratuais to authenticated;
grant all on table public.cliente_alteracoes_contratuais to service_role;
grant select, insert, update on table public.cliente_cadastro_operacional_sn to authenticated;
grant all on table public.cliente_cadastro_operacional_sn to service_role;
grant select, insert, delete on table public.cliente_contatos to authenticated;
grant all on table public.cliente_contatos to service_role;
grant select, insert, update on table public.cliente_atividades_mensais to authenticated;
grant all on table public.cliente_atividades_mensais to service_role;

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on function public.auditar_cadastro_operacional_editado() from public, anon, authenticated;
grant execute on function public.auditar_cadastro_operacional_editado() to service_role;

revoke all on function public.auditar_cliente_criado() from public, anon, authenticated;
grant execute on function public.auditar_cliente_criado() to service_role;

revoke all on function public.auditar_responsavel_cliente() from public, anon, authenticated;
grant execute on function public.auditar_responsavel_cliente() to service_role;

revoke all on function public.mes_corrente_sp(timestamp with time zone) from public, anon;
grant execute on function public.mes_corrente_sp(timestamp with time zone) to authenticated, service_role;

revoke all on function public.regime_tem_cadastro_operacional_sn(uuid) from public, anon;
grant execute on function public.regime_tem_cadastro_operacional_sn(uuid) to authenticated, service_role;

revoke all on function public.sou_responsavel_do_cliente(uuid) from public, anon;
grant execute on function public.sou_responsavel_do_cliente(uuid) to authenticated, service_role;

revoke all on function public.pode_editar_cadastro_operacional(uuid) from public, anon;
grant execute on function public.pode_editar_cadastro_operacional(uuid) to authenticated, service_role;

revoke all on function public.pode_ver_cliente(uuid) from public, anon;
grant execute on function public.pode_ver_cliente(uuid) to authenticated, service_role;

revoke all on function public.proteger_cadastro_operacional() from public, anon, authenticated;
grant execute on function public.proteger_cadastro_operacional() to service_role;


-- Bucket privado dos contratos (arquitetura.md, seção 3.9).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-clientes', 'documentos-clientes', false, 10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy documentos_clientes_delete_admin
on storage.objects
for delete
using (((bucket_id = 'documentos-clientes') AND (public.meu_papel() = 'admin')));

create policy documentos_clientes_insert_admin
on storage.objects
for insert
with check (((bucket_id = 'documentos-clientes') AND (public.meu_papel() = 'admin')));

create policy documentos_clientes_select_admin
on storage.objects
for select
using (((bucket_id = 'documentos-clientes') AND (public.meu_papel() = 'admin')));

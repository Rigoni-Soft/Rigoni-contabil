-- Parcelamentos do Cliente: zero, um ou vários por Cliente, cada um com código, parcelas restantes,
-- marca "é interno" e o PDF do acordo anexado. A tabela filha substitui `tem_parcelamento` e
-- `parcelamento_status` do Cadastro operacional (corte limpo, sem backfill: `supabase db reset`).
-- Quem edita o Cadastro operacional (Funcionário SN responsável, Líder SN, Admin) lê e escreve.
-- O que só o sistema grava (situação "quitado", quitação por zero, anexo, registro de envio) é
-- travado por gatilho BEFORE (ADR 0008, arquitetura.md §3.14).

CREATE TYPE public.parcelamento_situacao AS ENUM ('em_aberto', 'quitado');

CREATE TABLE public.cliente_parcelamentos (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    codigo text NOT NULL,
    parcelas_restantes integer NOT NULL,
    interno boolean DEFAULT false NOT NULL,
    arquivo_caminho text NOT NULL,
    situacao public.parcelamento_situacao DEFAULT 'em_aberto'::public.parcelamento_situacao NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliente_parcelamentos_pkey PRIMARY KEY (id),
    CONSTRAINT cliente_parcelamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE,
    CONSTRAINT cliente_parcelamentos_codigo_check CHECK (length(btrim(codigo)) BETWEEN 1 AND 60),
    CONSTRAINT cliente_parcelamentos_parcelas_restantes_check CHECK (parcelas_restantes >= 0),
    CONSTRAINT cliente_parcelamentos_cliente_id_codigo_key UNIQUE (cliente_id, codigo)
);

-- Registro de envio por parcelamento e parcela (AAAAMM): gravado pelo sistema na entrega aceita.
-- Base do status do mês (o reset mensal é automático), da idempotência do desconto e do bloqueio
-- de remoção. Nasce travado: nenhuma sessão de usuário escreve.
CREATE TABLE public.cliente_parcelamento_envios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parcelamento_id uuid NOT NULL,
    parcela text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliente_parcelamento_envios_pkey PRIMARY KEY (id),
    CONSTRAINT cliente_parcelamento_envios_parcelamento_id_fkey FOREIGN KEY (parcelamento_id) REFERENCES public.cliente_parcelamentos(id) ON DELETE CASCADE,
    CONSTRAINT cliente_parcelamento_envios_parcela_check CHECK (parcela ~ '^[0-9]{6}$'),
    CONSTRAINT cliente_parcelamento_envios_parcelamento_id_parcela_key UNIQUE (parcelamento_id, parcela)
);

-- Regras que valem para a sessão de usuário (RPC ou Data API). Sem auth.uid() (job, seed,
-- migration, ON DELETE CASCADE de um Cliente) o chamador é o servidor confiável e nada muda.
CREATE FUNCTION public.proteger_cliente_parcelamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if exists (select 1 from public.cliente_parcelamento_envios where parcelamento_id = old.id) then
      raise exception 'Parcelamento com guia enviada não pode ser removido.' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.situacao <> 'em_aberto' then
      raise exception 'A situação do Parcelamento é definida pelo sistema.' using errcode = '23514';
    end if;
  else
    if new.situacao is distinct from old.situacao or new.arquivo_caminho is distinct from old.arquivo_caminho then
      raise exception 'A situação e o anexo do Parcelamento não mudam pela edição.' using errcode = '23514';
    end if;
    if old.situacao = 'quitado' or old.parcelas_restantes = 0 then
      if new.codigo is distinct from old.codigo
         or new.parcelas_restantes is distinct from old.parcelas_restantes
         or new.interno is distinct from old.interno then
        raise exception 'Parcelamento quitado não pode ser alterado.' using errcode = '23514';
      end if;
      return new;
    end if;
  end if;

  if new.parcelas_restantes < 1 then
    raise exception 'Parcelas restantes: mínimo 1 (o zero é gravado pelo sistema ao quitar).' using errcode = '23514';
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.proteger_cliente_parcelamento_envio() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null then
    raise exception 'O registro de envio é gravado só pelo sistema.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- Edição manual do conjunto de Parcelamentos de um Cliente, numa transação: o que não está na
-- lista é removido (o gatilho recusa se houver envio), o que está entra ou tem código, parcelas e
-- "interno" atualizados. O anexo só é gravado na criação. `security invoker`: as policies abaixo
-- autorizam quem chama.
CREATE FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.cliente_parcelamentos
   where cliente_id = p_cliente_id
     and id not in (select (item ->> 'id')::uuid from jsonb_array_elements(p_itens) as item);

  -- UPDATE antes do INSERT: o gatilho BEFORE INSERT avaliaria a linha proposta de um Parcelamento
  -- quitado (parcelas em zero) antes de o ON CONFLICT resolvê-la.
  update public.cliente_parcelamentos p
     set codigo = item ->> 'codigo',
         parcelas_restantes = (item ->> 'parcelasRestantes')::integer,
         interno = (item ->> 'interno')::boolean
    from jsonb_array_elements(p_itens) as item
   where p.cliente_id = p_cliente_id and p.id = (item ->> 'id')::uuid;

  insert into public.cliente_parcelamentos (id, cliente_id, codigo, parcelas_restantes, interno, arquivo_caminho)
  select (item ->> 'id')::uuid, p_cliente_id, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho'
    from jsonb_array_elements(p_itens) as item
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;

CREATE TRIGGER cliente_parcelamentos_auditar AFTER INSERT OR UPDATE OR DELETE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE TRIGGER cliente_parcelamentos_proteger BEFORE INSERT OR UPDATE OR DELETE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

CREATE TRIGGER cliente_parcelamentos_proteger_sistema BEFORE INSERT OR UPDATE OR DELETE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento();

CREATE TRIGGER cliente_parcelamento_envios_proteger BEFORE INSERT OR UPDATE OR DELETE ON public.cliente_parcelamento_envios FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_envio();

ALTER TABLE public.cliente_parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_parcelamento_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos FOR SELECT USING (public.pode_ver_cliente(cliente_id));
CREATE POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos FOR INSERT WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));
CREATE POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos FOR UPDATE USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));
CREATE POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos FOR DELETE USING (public.pode_editar_cadastro_operacional(cliente_id));

-- Quem enxerga o Parcelamento (RLS acima) enxerga o registro de envio dele.
CREATE POLICY cliente_parcelamento_envios_select ON public.cliente_parcelamento_envios FOR SELECT
  USING (exists (select 1 from public.cliente_parcelamentos p where p.id = parcelamento_id));

-- anon não recebe nada; o registro de envio é leitura para a sessão e escrita só do service_role.
grant select, insert, update, delete on table public.cliente_parcelamentos to authenticated;
grant all on table public.cliente_parcelamentos to service_role;
grant select on table public.cliente_parcelamento_envios to authenticated;
grant all on table public.cliente_parcelamento_envios to service_role;

revoke all on function public.proteger_cliente_parcelamento() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento() to service_role;
revoke all on function public.proteger_cliente_parcelamento_envio() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento_envio() to service_role;
revoke all on function public.salvar_parcelamentos_cliente(uuid, jsonb) from public, anon;
grant execute on function public.salvar_parcelamentos_cliente(uuid, jsonb) to authenticated, service_role;

-- Bucket privado dos PDFs dos acordos: sem política para usuário. Só o servidor (service role) lê e
-- grava, depois de checar a permissão no caso de uso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parcelamentos-clientes', 'parcelamentos-clientes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Saem do Cadastro operacional os dois campos que o Parcelamento por linha substitui.
DROP TRIGGER cliente_cadastro_operacional_auditar ON public.cliente_cadastro_operacional_sn;
DROP FUNCTION public.editar_cadastro_operacional_cliente(uuid, public.forma_envio, public.documento_obrigatorio_status, public.das_status, date, boolean, public.parcelamento_status, text, jsonb, date, boolean, boolean, boolean);

CREATE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
       and not exists (
         select 1 from public.cliente_parcelamento_envios e
          where e.parcelamento_id = p.id
            and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
       )
  );
$$;
revoke all on function public.cliente_tem_parcelamento_pendente(uuid) from public, anon, authenticated;
grant execute on function public.cliente_tem_parcelamento_pendente(uuid) to service_role;

-- O job de envio da guia de parcelamento (#87) segue vivo até a regra única o reescrever: "tem
-- parcelamento pendente" passa a ser "ao menos um Parcelamento em aberto sem registro de envio do
-- mês corrente". ponytail: um envio marca todos os em aberto do mês; a regra por código é do job novo.
CREATE OR REPLACE FUNCTION public.clientes_para_parcelamento(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.cliente_id, b.empresa, b.email, b.forma_envio, b.contato_nome, b.contato_telefone,
         b.ultima_mensagem_do_contato_em
    from public.clientes_para_envio_base() b
   where public.cliente_tem_parcelamento_pendente(b.cliente_id)
     and (p_apos is null or b.cliente_id > p_apos)
   order by b.cliente_id
   limit p_limite;
$$;


CREATE OR REPLACE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'parcelamento' and token = p_token
     and concluido_em is null;
  if not found then
    return false;
  end if;

  if not public.cliente_tem_parcelamento_pendente(p_cliente_id) then
    return false;
  end if;

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela)
  select p.id, to_char(public.mes_corrente_sp(), 'YYYYMM')
    from public.cliente_parcelamentos p
   where p.cliente_id = p_cliente_id and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
  on conflict (parcelamento_id, parcela) do nothing;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval DEFAULT '00:15:00'::interval) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_elegivel boolean;
  v_token uuid;
begin
  if p_tipo not in ('das', 'parcelamento') then
    raise exception 'tipo de envio automatico invalido: %', p_tipo;
  end if;

  select case p_tipo
           when 'das' then o.das_status = 'pronto'
           else public.cliente_tem_parcelamento_pendente(p_cliente_id)
         end
    into v_elegivel
    from public.cliente_cadastro_operacional_sn o
   where o.cliente_id = p_cliente_id
     for update;
  if not coalesce(v_elegivel, false) then
    return null;
  end if;

  insert into public.envios_automaticos as e (cliente_id, tipo, token)
  values (p_cliente_id, p_tipo, gen_random_uuid())
  on conflict (cliente_id, tipo) do update
     set token = gen_random_uuid(), reservado_em = now(), concluido_em = null
   where e.concluido_em is not null or e.reservado_em < now() - p_validade
  returning e.token into v_token;
  return v_token;
end;
$$;

ALTER TABLE public.cliente_cadastro_operacional_sn
    DROP COLUMN tem_parcelamento,
    DROP COLUMN parcelamento_status;
DROP TYPE public.parcelamento_status;

CREATE TRIGGER cliente_cadastro_operacional_auditar AFTER INSERT OR UPDATE OF forma_envio, documento_obrigatorio, das_status, data_envio_das, observacoes_gerais ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

CREATE FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) RETURNS void
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
revoke execute on function public.editar_cadastro_operacional_cliente(uuid, forma_envio, documento_obrigatorio_status, das_status, date, text, jsonb, date, boolean, boolean, boolean) from public, anon;
grant execute on function public.editar_cadastro_operacional_cliente(uuid, forma_envio, documento_obrigatorio_status, das_status, date, text, jsonb, date, boolean, boolean, boolean) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.clientes (id, empresa, cnpj, regime, contrato_social_caminho, email)
  values (p_id, p_empresa, p_cnpj, p_regime, p_contrato_social_caminho, p_email);

  insert into public.cliente_alteracoes_contratuais (id, cliente_id, numero, data, arquivo_caminho)
  select
    (item ->> 'id')::uuid,
    p_id,
    (item ->> 'numero')::integer,
    (item ->> 'data')::date,
    item ->> 'arquivoCaminho'
  from jsonb_array_elements(p_alteracoes) as item;

  if p_regime in ('mei', 'simples_nacional') then
    insert into public.cliente_cadastro_operacional_sn
      (cliente_id, forma_envio, documento_obrigatorio, das_status, observacoes_gerais)
    values
      (p_id, 'whatsapp', 'negativo', 'pendente', '');
  end if;
end;
$$;

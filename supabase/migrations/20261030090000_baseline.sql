-- Baseline: estado final do schema public, buckets e policies do storage (consolida as migrations anteriores).
set check_function_bodies = false;

-- Menor privilégio: objetos novos nascem sem acesso do anon e sem grant implícito ao authenticated (só os GRANTs explícitos abaixo).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;


-- Name: public; Type: SCHEMA; Schema: -; Owner: -

-- Name: autor_mensagem; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.autor_mensagem AS ENUM (
    'contato',
    'ura',
    'funcionario'
);

-- Name: das_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.das_status AS ENUM (
    'pendente',
    'pronto',
    'enviado',
    'sem_movimento'
);

-- Name: documento_obrigatorio_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.documento_obrigatorio_status AS ENUM (
    'positivo',
    'negativo',
    'nao_se_aplica'
);

-- Name: entrega_mensagem; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.entrega_mensagem AS ENUM (
    'pendente',
    'entregue',
    'falha'
);

-- Name: forma_envio; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.forma_envio AS ENUM (
    'whatsapp',
    'email',
    'whatsapp_e_email'
);

-- Name: guia_parcela_pgfn_estado; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.guia_parcela_pgfn_estado AS ENUM (
    'a_confirmar',
    'confirmada'
);

-- Name: papel; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.papel AS ENUM (
    'admin',
    'lider_setor',
    'funcionario'
);

-- Name: parcelamento_situacao; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.parcelamento_situacao AS ENUM (
    'em_aberto',
    'quitado'
);

-- Name: regime; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.regime AS ENUM (
    'simples_nacional',
    'lucro_presumido',
    'lucro_real',
    'mei'
);

-- Name: resultado_acao; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.resultado_acao AS ENUM (
    'sucesso',
    'falha',
    'falha_compensacao'
);

-- Name: setor_slug; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.setor_slug AS ENUM (
    'rh',
    'tributario',
    'simples_nacional',
    'contabil',
    'societario',
    'condominios',
    'financeiro',
    'administrativo',
    'recepcao'
);

-- Name: status_atendimento; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.status_atendimento AS ENUM (
    'em_andamento',
    'encerrado'
);

-- Name: tipo_alerta_setor; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.tipo_alerta_setor AS ENUM (
    'das_pendente',
    'falha_envio',
    'contato_ausente',
    'entrega_parcial',
    'parcelamento_sem_guia',
    'financeiro_ausente',
    'guia_pgfn_pendente'
);

-- Name: abrir_atendimento(text, text, uuid, public.setor_slug, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text DEFAULT NULL::text, p_cnpj_informado text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_cliente uuid := coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado));
begin
  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, fila_desde, fila_funcionario_id, resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave, v_cliente, p_setor, clock_timestamp(),
    public.destinatario_da_espera(v_cliente, p_setor), p_resumo, p_cnpj_informado
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto', m ->> 'idExterno'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Name: acesso_liberado(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.acesso_liberado() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and senha_trocada_em is not null and desativado_em is null
  );
$$;

-- Name: alterar_papel_usuario(uuid, uuid, public.papel); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel) RETURNS void
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
    select 1 from public.cliente_cadastro_operacional_sn where responsavel_id = alvo_id
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

-- Name: anexar_alteracao_contratual(uuid, uuid, integer, date, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.cliente_alteracoes_contratuais (id, cliente_id, numero, data, arquivo_caminho)
  values (p_id, p_cliente_id, p_numero, p_data, p_caminho);
$$;

-- Name: anexar_mensagem_atendimento(text, public.autor_mensagem, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.anexar_mensagem_atendimento(p_chave text, p_autor public.autor_mensagem, p_texto text, p_id_externo text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  select id into v_id from public.atendimentos
  where chave_telefone = p_chave and status = 'em_andamento'
  order by criado_em desc
  limit 1
  for update;
  if v_id is null then
    return false;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  values (v_id, p_autor, p_texto, p_id_externo)
  on conflict (atendimento_id, id_externo) where id_externo is not null do nothing;
  return true;
end;
$$;

-- Name: assumir_atendimento(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.assumir_atendimento(p_atendimento_id uuid, p_ator uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_atendimento public.atendimentos;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  v_setor := v_atendimento.setor;
  -- Elegibilidade antes do dono: quem não pode assumir não descobre se alguém já assumiu. Dirigido a
  -- outra pessoa, ou sem destinatário fora da Recepção, ninguém além do destinatário assume.
  if not public.atendente_elegivel(p_ator, v_setor)
     or (v_atendimento.fila_funcionario_id is not null
         and v_atendimento.fila_funcionario_id <> p_ator)
     or (v_atendimento.fila_funcionario_id is null and v_setor <> 'recepcao') then
    return jsonb_build_object('status', 'inelegivel');
  end if;
  if v_atendimento.funcionario_id is not null then
    return jsonb_build_object('status', 'ja_assumido');
  end if;

  update public.atendimentos
  set funcionario_id = p_ator, fila_funcionario_id = null, fila_desde = null, assumido_em = now()
  where id = p_atendimento_id;
  insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
  values (p_atendimento_id, p_ator);
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (gen_random_uuid(), p_ator, v_setor, 'atendimento.assumir', p_atendimento_id::text, 'sucesso');

  return jsonb_build_object('status', 'assumido');
end;
$$;

-- Name: atendente_elegivel(uuid, public.setor_slug); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.atendente_elegivel(p_funcionario uuid, p_setor public.setor_slug) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.perfis
  where id = p_funcionario and setor = p_setor and desativado_em is null
  for share;
  return found;
end;
$$;

-- Name: auditar_alteracao_contratual_anexada(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.auditar_alteracao_contratual_anexada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or current_setting('app.cliente_auditado', true) = new.cliente_id::text then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.anexar-alteracao',
    (select cnpj from public.clientes where id = new.cliente_id) || ' - alteração nº ' || new.numero,
    'sucesso', now()
  );
  return null;
end;
$$;

-- Name: auditar_cadastro_operacional_editado(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: auditar_cliente_criado(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: auditar_cliente_parcelamento_guia(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.auditar_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_parcelamento uuid;
  v_competencia text;
  v_acao text;
  v_alvo text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_parcelamento := old.parcelamento_id;
    v_competencia := old.competencia;
    v_acao := 'parcelamento.remover-guia';
  else
    v_parcelamento := new.parcelamento_id;
    v_competencia := new.competencia;
    if tg_op = 'INSERT' then
      v_acao := 'parcelamento.anexar-guia';
    elsif new.arquivo_caminho is distinct from old.arquivo_caminho then
      v_acao := 'parcelamento.trocar-guia';
    else
      v_acao := 'parcelamento.confirmar-guia';
    end if;
  end if;

  select c.cnpj || ' - ' || p.codigo || ' - ' || v_competencia into v_alvo
    from public.cliente_parcelamentos p join public.clientes c on c.id = p.cliente_id
   where p.id = v_parcelamento;
  if v_alvo is null then
    return null;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), public.meu_setor(), v_acao, v_alvo, 'sucesso', now());
  return null;
end;
$$;

-- Name: auditar_cliente_responsavel(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.auditar_cliente_responsavel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null
     or current_setting('rigoni.removendo_responsavel_por_desativacao', true) = 'on'
     or (tg_op = 'UPDATE' and new.responsavel_id = old.responsavel_id) then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(),
    case tg_op
      when 'DELETE' then 'cliente.remover-responsavel'
      when 'INSERT' then 'cliente.atribuir-responsavel'
      else 'cliente.trocar-responsavel'
    end,
    (select cnpj from public.clientes where id = v_cliente), 'sucesso', now()
  );
  return null;
end;
$$;

-- Name: auditar_das_da_ura(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.auditar_das_da_ura(p_cliente_id uuid, p_acao text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'simples_nacional',
         p_acao, cnpj, 'sucesso', now()
  from public.clientes where id = p_cliente_id;
$$;

-- Name: auditar_feriado(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.auditar_feriado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(),
      case tg_op when 'INSERT' then 'feriado.cadastrar' else 'feriado.remover' end,
      coalesce(new.data, old.data)::text, 'sucesso', now()
    );
  end if;
  return coalesce(new, old);
end;
$$;

-- Name: auditar_responsavel_cliente(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: avisar_nova_alteracao(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.avisar_nova_alteracao() RETURNS trigger
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
      select p.id from public.cliente_cadastro_operacional_sn c
        join public.perfis p on p.id = c.responsavel_id
       where c.cliente_id = new.cliente_id and p.desativado_em is null
    ) d
   where exists (select 1 from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id);
  return null;
end;
$$;

-- Name: avisar_novo_cliente_sn(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.avisar_novo_cliente_sn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id)
  select p.id, 'novo_cliente', new.cliente_id
    from public.perfis p
   where p.setor = 'simples_nacional' and p.papel = 'lider_setor' and p.desativado_em is null;
  return null;
end;
$$;

-- Name: cliente_tem_parcelamento_pendente(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       and (
         (p.origem is distinct from 'pgfn'
          and not exists (
            select 1 from public.cliente_parcelamento_envios e
             where e.parcelamento_id = p.id
               and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
          ))
         or
         (p.origem = 'pgfn'
          and exists (
            select 1 from public.cliente_parcelamento_guias g
             where g.parcelamento_id = p.id
               and g.estado = 'confirmada'
               and g.competencia <= to_char(public.mes_corrente_sp(), 'YYYYMM')
               and not exists (
                 select 1 from public.cliente_parcelamento_envios e
                  where e.parcelamento_id = p.id and e.parcela = g.competencia
               )
          ))
       )
  );
$$;

-- Name: clientes_com_parcelamento_pgfn(uuid, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.clientes_com_parcelamento_pgfn(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, pendencias jsonb)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.id, c.empresa, public.pendencias_guia_pgfn(c.id)
    from public.clientes c
   where (p_apos is null or c.id > p_apos)
     and (
       exists (
         select 1 from public.cliente_parcelamentos p
          where p.cliente_id = c.id and p.origem = 'pgfn'
            and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       )
       or exists (
         select 1 from public.alertas_setor a
          where a.cliente_id = c.id and a.origem = 'lembrete_pgfn' and a.resolvido_em is null
       )
     )
   order by c.id
   limit p_limite;
$$;

-- Name: clientes_para_envio_base(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.clientes_para_envio_base() RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
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
    select p.nome, n.chave_nacional,
           case when length(n.chave_nacional) in (10, 11)
                then '55' || n.chave_nacional else n.digitos end as telefone_envio
    from public.cliente_contatos p,
         lateral (select regexp_replace(p.telefone, '\D', '', 'g') as digitos) d,
         lateral (
           select d.digitos,
                  case when length(d.digitos) > 11 and left(d.digitos, 2) = '55'
                       then substr(d.digitos, 3) else d.digitos end as chave_nacional
         ) n
    where p.cliente_id = c.id and p.padrao
  ) ct on true;
$$;

-- Name: clientes_para_lembrete(uuid, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.clientes_para_lembrete(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.*
    from public.clientes_para_envio_base() b
   where p_apos is null or b.cliente_id > p_apos
   order by b.cliente_id
   limit p_limite;
$$;

-- Name: clientes_para_parcelamento(uuid, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.clientes_para_parcelamento(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
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

-- Name: concluir_envio_automatico_das(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date, p_caminho text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'das' and token = p_token and concluido_em is null;
  if not found then
    return false;
  end if;

  update public.cliente_cadastro_operacional_sn
     set das_status = 'enviado', data_envio_das = p_data, caminho_guia_das = p_caminho,
         atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'pronto';
  if not found then
    return false;
  end if;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-das-automatico');
  return true;
end;
$$;

-- Name: concluir_envio_automatico_parcelamento(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'parcelamento' and token = p_token
     and concluido_em is null;
  return found;
end;
$$;

-- Name: criar_cliente(uuid, text, text, public.regime, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text DEFAULT NULL::text) RETURNS void
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

-- Name: desativar_usuario(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) RETURNS void
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

  with removidos as (
    update public.cliente_cadastro_operacional_sn
    set responsavel_id = null
    where responsavel_id = alvo_id
    returning cliente_id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'cliente.remover-responsavel', c.cnpj, 'sucesso', now()
  from removidos r
  join public.clientes c on c.id = r.cliente_id;

  -- Responsável dos outros Setores (#165): a desativação o remove, com a auditoria de sempre. A marca
  -- impede o gatilho de auditar de novo as mesmas linhas.
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

  -- A marca vale só nesta transação: quem protege o dono do Atendimento (aviso de inatividade, #73)
  -- distingue a devolução da Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        -- O Atendimento volta ao destinatário que a regra do Setor aponta agora: o Responsável do
        -- Cliente (o desativado já foi removido acima) ou, sem ele, o Líder ativo. Na Recepção, ou sem
        -- destinatário, fica sem dono nem destinatário.
        fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor),
        assumido_em = null,
        -- Quem estava sendo atendido entra agora (atrás de quem já esperava); quem esperava
        -- dirigido ao desativado mantém a espera. Os `a.*` do SET são os valores de antes.
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

-- Name: destinatario_da_espera(uuid, public.setor_slug); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select case when p_setor = 'recepcao' then null else coalesce(
    (select p.id
     from public.perfis p
     where p.id = case
         when p_setor = 'simples_nacional' then
           (select o.responsavel_id from public.cliente_cadastro_operacional_sn o where o.cliente_id = p_cliente_id)
         else
           (select r.responsavel_id from public.cliente_responsaveis r
            where r.cliente_id = p_cliente_id and r.setor = p_setor)
       end
       and p.papel = 'funcionario' and p.setor = p_setor and p.desativado_em is null),
    (select p.id from public.perfis p
     where p.setor = p_setor and p.papel = 'lider_setor' and p.desativado_em is null
     limit 1)
  ) end;
$$;

-- Name: documentos_contratuais_do_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.documentos_contratuais_do_cliente(p_cliente_id uuid) RETURNS TABLE(tipo text, numero integer, data date, caminho text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select 'contrato', null::integer, null::date, c.contrato_social_caminho
    from public.clientes c
   where c.id = p_cliente_id
     and c.contrato_social_caminho is not null
     and public.pode_ver_documentos_contratuais(p_cliente_id)
  union all
  select 'alteracao', a.numero, a.data, a.arquivo_caminho
    from public.cliente_alteracoes_contratuais a
   where a.cliente_id = p_cliente_id
     and public.pode_ver_documentos_contratuais(p_cliente_id)
   order by 2 desc nulls last;
$$;

-- Name: editar_cadastro_operacional_cliente(uuid, public.forma_envio, public.documento_obrigatorio_status, public.das_status, date, text, jsonb, date, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: encerrar_atendimento(uuid, uuid, uuid, public.setor_slug); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.atendimentos set status = 'encerrado'
  where id = p_atendimento_id and status = 'em_andamento'
    and funcionario_id is not distinct from p_funcionario_id;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.encerrar',
    p_atendimento_id::text, 'sucesso'
  );
  return jsonb_build_object('status', 'encerrado');
end;
$$;

-- Name: encerrar_atendimentos_por_silencio(timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_candidato record;
  v_atendimento record;
  v_encerrados integer := 0;
begin
  for v_candidato in
    select a.id, a.funcionario_id
    from public.atendimentos a
    where a.status = 'em_andamento' and a.funcionario_id is not null
      and coalesce(
        (select max(m.criado_em) from public.mensagens m
          where m.atendimento_id = a.id and m.autor = 'contato'),
        a.criado_em
      ) <= p_corte
    order by a.id
  loop
    select a.id, a.setor, a.funcionario_id, a.criado_em into v_atendimento
    from public.atendimentos a
    where a.id = v_candidato.id and a.status = 'em_andamento'
      and a.funcionario_id is not distinct from v_candidato.funcionario_id
    for update;
    continue when not found;

    -- Statement novo: enxerga a Mensagem comitada enquanto esperava o lock.
    continue when coalesce(
      (select max(m.criado_em) from public.mensagens m
        where m.atendimento_id = v_atendimento.id and m.autor = 'contato'),
      v_atendimento.criado_em
    ) > p_corte;

    if public.encerrar_atendimento(
         v_atendimento.id, v_atendimento.funcionario_id, p_ator, v_atendimento.setor
       ) ->> 'status' = 'encerrado' then
      v_encerrados := v_encerrados + 1;
    end if;
  end loop;
  return v_encerrados;
end;
$$;

-- Name: fila_do_setor(public.setor_slug); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.fila_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, fila_funcionario_id uuid, fila_desde timestamp with time zone, telefone text, contato_nome text, empresa text, cnpj text, resumo text, origem_setor public.setor_slug, origem_nome text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    a.id, a.fila_funcionario_id, a.fila_desde, a.telefone,
    (select ct.nome from public.cliente_contatos ct
      where ct.cliente_id = a.cliente_id
        and regexp_replace(ct.telefone, '\D', '', 'g') = a.chave_telefone
      order by ct.padrao desc, ct.criado_em limit 1),
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

-- Name: finalizar_entrega_mensagem_do_funcionario(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.finalizar_entrega_mensagem_do_funcionario(p_id uuid, p_entregue boolean) RETURNS boolean
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with finalizada as (
    update public.mensagens
    set entrega = case when p_entregue then 'entregue'::public.entrega_mensagem
                       else 'falha'::public.entrega_mensagem end
    where id = p_id and autor = 'funcionario' and entrega = 'pendente'
    returning 1
  )
  select exists (select 1 from finalizada);
$$;

-- Name: finalizar_troca_senha(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.finalizar_troca_senha(usuario_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_perfil public.perfis;
begin
  select * into v_perfil from public.perfis where id = usuario_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  if v_perfil.senha_trocada_em is not null then
    return;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), v_perfil.id, v_perfil.setor,
    'usuario.trocar_senha_primeiro_acesso', v_perfil.email, 'sucesso', now()
  );

  update public.perfis
  set senha_trocada_em = now(), senha_auth_alterada_em = null
  where id = v_perfil.id;
end;
$$;

-- Name: identificar_contato_por_telefone(text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.identificar_contato_por_telefone(p_telefone text) RETURNS TABLE(cliente_id uuid, nome text, empresa text, padrao boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, ct.nome, c.empresa, ct.padrao
  from public.cliente_contatos ct
  join public.clientes c on c.id = ct.cliente_id
  where regexp_replace(ct.telefone, '\D', '', 'g') = p_telefone
  order by ct.padrao desc, ct.criado_em;
$$;

-- Name: liberar_anexo_em_envio(text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.liberar_anexo_em_envio(p_caminho text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  delete from public.anexos_em_envio where caminho = p_caminho;
$$;

-- Name: liberar_envio_automatico(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  delete from public.envios_automaticos
   where cliente_id = p_cliente_id and tipo = p_tipo and token = p_token and concluido_em is null;
$$;

-- Name: liberar_guia_pgfn_do_envio(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.liberar_guia_pgfn_do_envio(p_parcelamento_id uuid, p_competencia text, p_token uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.cliente_parcelamento_guias
     set em_envio_ate = null, em_envio_token = null
   where parcelamento_id = p_parcelamento_id and competencia = p_competencia
     and em_envio_token = p_token;
$$;

-- Name: avisos_cadastro; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.avisos_cadastro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destinatario_id uuid NOT NULL,
    tipo text NOT NULL,
    cliente_id uuid NOT NULL,
    alteracao_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    visto_em timestamp with time zone,
    alteracao_numero integer
);

-- Name: listar_avisos_cadastro(integer, boolean, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.listar_avisos_cadastro(p_limite integer DEFAULT 30, p_cursor_visto boolean DEFAULT NULL::boolean, p_cursor_criado_em timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.avisos_cadastro
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select a.*
    from public.avisos_cadastro a
   where p_cursor_id is null
      or (a.visto_em is not null) > p_cursor_visto
      or ((a.visto_em is not null) = p_cursor_visto
          and (a.criado_em < p_cursor_criado_em or (a.criado_em = p_cursor_criado_em and a.id < p_cursor_id)))
   order by (a.visto_em is not null), a.criado_em desc, a.id desc
   limit p_limite;
$$;

-- Name: marcar_aviso_visto(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.marcar_aviso_visto(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.avisos_cadastro
     set visto_em = now()
   where id = p_id and destinatario_id = auth.uid() and visto_em is null;
$$;

-- Name: mes_corrente_sp(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.mes_corrente_sp(p_agora timestamp with time zone DEFAULT now()) RETURNS date
    LANGUAGE sql IMMUTABLE
    AS $$
  select date_trunc('month', p_agora at time zone 'America/Sao_Paulo')::date;
$$;

-- Name: meu_papel(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.meu_papel() RETURNS public.papel
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select papel from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

-- Name: meu_setor(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.meu_setor() RETURNS public.setor_slug
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select setor from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

-- Name: pendencias_guia_pgfn(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.pendencias_guia_pgfn(p_cliente_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
                    'codigo', p.codigo,
                    'estado', case when g.parcelamento_id is null then 'sem_guia' else 'a_confirmar' end
                  ) order by p.codigo), '[]'::jsonb)
    from public.cliente_parcelamentos p
    left join public.cliente_parcelamento_guias g
      on g.parcelamento_id = p.id
     and g.competencia = to_char(public.mes_corrente_sp(), 'YYYYMM')
   where p.cliente_id = p_cliente_id
     and p.origem = 'pgfn' and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
     and g.estado is distinct from 'confirmada';
$$;

-- Name: pode_anexar_ao_atendimento(text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.pode_anexar_ao_atendimento(p_atendimento text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.atendimentos a
    join public.perfis p on p.id = auth.uid()
    where a.id::text = p_atendimento
      and a.status = 'em_andamento'
      and p.desativado_em is null
      and p.banido_em is null
      and (
        p.papel = 'admin'
        or (p.papel = 'lider_setor' and p.setor = a.setor)
        or a.funcionario_id = p.id
      )
  );
$$;

-- Name: pode_editar_cadastro_operacional(uuid); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: pode_ver_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.pode_ver_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- acesso_liberado(): primeiro acesso finalizado (PR #69, ADR 0002).
  select public.acesso_liberado() and case
    when public.meu_papel() is null then false
    when public.meu_papel() = 'funcionario' and public.meu_setor() is distinct from 'recepcao'
      then public.sou_responsavel_do_cliente(p_cliente_id)
    else true
  end;
$$;

-- Name: pode_ver_documentos_contratuais(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Cliente nulo (objeto fora do padrão): pode_ver_cliente(null) é true para Líder, então barra aqui.
  select p_cliente_id is not null
    and public.pode_ver_cliente(p_cliente_id)
    and (public.meu_papel() = 'admin' or public.meu_setor() = 'simples_nacional');
$$;

-- Name: proteger_cadastro_operacional(); Type: FUNCTION; Schema: public; Owner: -

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
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
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

-- Name: proteger_cliente_parcelamento(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: proteger_cliente_parcelamento_anexo(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_cliente_parcelamento_anexo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and new.arquivo_caminho not like new.cliente_id::text || '/' || new.id::text || '-%' then
    raise exception 'O anexo do Parcelamento não pertence a este registro.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Name: proteger_cliente_parcelamento_envio(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: proteger_cliente_parcelamento_guia(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if exists (
    select 1 from public.cliente_parcelamento_envios e
     where e.parcelamento_id = coalesce(new.parcelamento_id, old.parcelamento_id)
       and e.parcela = coalesce(new.competencia, old.competencia)
  ) then
    raise exception 'Competência já enviada: não aceita guia nova nem alteração.' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    if old.em_envio_ate > now() then
      raise exception 'Guia em envio: tente novamente em instantes.' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.cliente_parcelamentos p where p.id = new.parcelamento_id and p.origem = 'pgfn'
    ) then
      raise exception 'Só Parcelamento da PGFN recebe guia anexada.' using errcode = '23514';
    end if;
    new.estado := 'a_confirmar';
    new.anexado_por := auth.uid();
    new.anexado_em := now();
    new.confirmado_por := null;
    new.confirmado_em := null;
    new.em_envio_ate := null;
    new.em_envio_token := null;
    return new;
  end if;

  new.em_envio_ate := old.em_envio_ate;
  new.em_envio_token := old.em_envio_token;

  -- Troca do PDF: a guia nova refaz a conferência, então volta a "a confirmar".
  if new.arquivo_caminho is distinct from old.arquivo_caminho then
    if old.em_envio_ate > now() then
      raise exception 'Guia em envio: tente novamente em instantes.' using errcode = '23514';
    end if;
    new.estado := 'a_confirmar';
    new.anexado_por := auth.uid();
    new.anexado_em := now();
    new.confirmado_por := null;
    new.confirmado_em := null;
    return new;
  end if;

  if new.conta_negociacao is distinct from old.conta_negociacao then
    raise exception 'A conta de negociação da guia só muda com a troca do PDF.' using errcode = '23514';
  end if;
  if old.estado = 'confirmada' or new.estado is distinct from 'confirmada' then
    raise exception 'A guia só muda de "a confirmar" para confirmada.' using errcode = '23514';
  end if;
  new.confirmado_por := auth.uid();
  new.confirmado_em := now();
  new.motivo := null;
  return new;
end;
$$;

-- Name: proteger_cliente_parcelamento_guia_caminho(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_cliente_parcelamento_guia_caminho() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.arquivo_caminho is not distinct from old.arquivo_caminho
     and new.competencia is not distinct from old.competencia then
    return new;
  end if;
  if not exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = new.parcelamento_id
       and new.arquivo_caminho like p.cliente_id::text || '/guias-pgfn/' || p.id::text || '/' || new.competencia || '-%'
  ) then
    raise exception 'O PDF da guia não pertence a este Parcelamento e competência.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Name: proteger_cliente_parcelamento_pgfn(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_cliente_parcelamento_pgfn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or old.origem is distinct from 'pgfn' then
    return new;
  end if;
  if new.codigo is distinct from old.codigo
     or new.origem is distinct from old.origem
     or new.interno is distinct from old.interno
     or new.parcelas_restantes is distinct from old.parcelas_restantes then
    raise exception 'Parcelamento da PGFN só ganha guias novas: código, origem, marca de interno e parcelas restantes não se editam.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Name: proteger_cliente_responsavel(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_cliente_responsavel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null
     and (public.meu_papel() is distinct from 'lider_setor'
          or public.meu_setor() is distinct from new.setor) then
    raise exception 'Só o Líder do Setor atribui o Responsável.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.perfis
    where id = new.responsavel_id
      and papel = 'funcionario'
      and setor = new.setor
      and desativado_em is null
    for share
  ) then
    raise exception 'O Responsável deve ser Funcionário ativo do Setor.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Name: proteger_das_enviado_do_sistema(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.proteger_das_enviado_do_sistema() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atual public.das_status;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    v_atual := old.das_status;
  else
    select das_status into v_atual from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id;
  end if;

  if new.das_status = 'enviado' and v_atual is distinct from 'enviado' then
    raise exception 'O status DAS "enviado" é definido apenas pelo sistema.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.das_status = 'enviado' then
    new.data_envio_das := old.data_envio_das;
  else
    new.data_envio_das := null;
  end if;

  if tg_op = 'UPDATE' then
    new.caminho_guia_das := old.caminho_guia_das;
  else
    new.caminho_guia_das := null;
  end if;

  return new;
end;
$$;

-- Name: proteger_responsavel_cliente(); Type: FUNCTION; Schema: public; Owner: -

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

-- Name: reconciliar_esperas_ao_surgir_destinatario(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_table_name = 'cliente_responsaveis' then
    perform public.reconciliar_esperas_sem_destinatario(new.setor, new.cliente_id);
  elsif tg_table_name = 'cliente_cadastro_operacional_sn' then
    perform public.reconciliar_esperas_sem_destinatario('simples_nacional', new.cliente_id);
  else
    perform public.reconciliar_esperas_sem_destinatario(new.setor);
  end if;
  return null;
end;
$$;

-- Name: reconciliar_esperas_sem_destinatario(public.setor_slug, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.reconciliar_esperas_sem_destinatario(p_setor public.setor_slug, p_cliente_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_setor is null or p_setor = 'recepcao' then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  update public.atendimentos a
  set fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor)
  where a.status = 'em_andamento'
    and a.setor = p_setor
    and a.funcionario_id is null
    and a.fila_funcionario_id is null
    and (p_cliente_id is null or a.cliente_id = p_cliente_id)
    and public.destinatario_da_espera(a.cliente_id, a.setor) is not null;
end;
$$;

-- Name: regime_tem_cadastro_operacional_sn(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.regime_tem_cadastro_operacional_sn(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and exists (
    select 1 from public.clientes
    where id = p_cliente_id and regime in ('simples_nacional', 'mei')
  );
$$;

-- Name: registrar_acao_auditoria(uuid, uuid, public.setor_slug, text, text, public.resultado_acao); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_acao_auditoria(p_id uuid, p_ator uuid, p_setor public.setor_slug, p_acao text, p_alvo text, p_resultado public.resultado_acao) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_ator is null then
    raise exception 'ator obrigatorio.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (p_id, p_ator, p_setor, p_acao, p_alvo, p_resultado, now());
end;
$$;

-- Name: registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text DEFAULT 'lembretes'::text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem, origem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem, p_origem)
  on conflict (cliente_id, tipo, origem) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

-- Name: registrar_auth_senha_alterada(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_auth_senha_alterada(usuario_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.perfis
  set senha_auth_alterada_em = coalesce(senha_auth_alterada_em, now())
  where id = usuario_id and senha_trocada_em is null;
$$;

-- Name: registrar_envio_parcelamento(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text, p_caminho text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid;
begin
  select cliente_id into v_cliente_id
    from public.cliente_parcelamentos
   where id = p_parcelamento_id and situacao = 'em_aberto' and parcelas_restantes > 0
     for update;
  if not found then
    return 'nao_elegivel';
  end if;

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela, identidade, caminho)
  values (p_parcelamento_id, p_parcela, p_identidade, p_caminho)
  on conflict (parcelamento_id, parcela) do nothing;
  if not found then
    return 'ja_registrado';
  end if;

  update public.cliente_parcelamentos
     set parcelas_restantes = parcelas_restantes - 1,
         situacao = case when parcelas_restantes - 1 = 0 then 'quitado'::public.parcelamento_situacao else situacao end
   where id = p_parcelamento_id;

  perform public.auditar_das_da_ura(v_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return 'registrado';
end;
$$;

-- Name: registrar_mensagem_do_funcionario(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_mensagem_do_funcionario(p_atendimento_id uuid, p_ator uuid, p_texto text, p_anexo jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_perfil public.perfis;
  v_atendimento public.atendimentos;
  v_id uuid;
begin
  select * into v_perfil from public.perfis
  where id = p_ator and desativado_em is null and banido_em is null
  for share;
  if not found then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id
  for update;
  if not found or v_atendimento.status <> 'em_andamento' then
    return jsonb_build_object('status', 'encerrada');
  end if;
  -- Mesma regra de `podeTransferir`: dono, Líder do Setor onde o Atendimento está, ou Admin.
  if not (
    v_perfil.papel = 'admin'
    or (v_perfil.papel = 'lider_setor' and v_perfil.setor = v_atendimento.setor)
    or v_perfil.id is not distinct from v_atendimento.funcionario_id
  ) then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  insert into public.mensagens (
    atendimento_id, autor, funcionario_id, texto, entrega,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, 'funcionario', p_ator, p_texto, 'pendente',
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  returning id into v_id;
  return jsonb_build_object('status', 'registrada', 'id', v_id);
end;
$$;

-- Name: registrar_mensagem_recebida(uuid, public.autor_mensagem, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.registrar_mensagem_recebida(p_atendimento_id uuid, p_autor public.autor_mensagem, p_texto text, p_id_externo text DEFAULT NULL::text, p_anexo jsonb DEFAULT NULL::jsonb) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_status public.status_atendimento;
begin
  select status into v_status from public.atendimentos
  where id = p_atendimento_id
  for update;
  if v_status is distinct from 'em_andamento' then
    return 'encerrada';
  end if;

  insert into public.mensagens (
    atendimento_id, autor, texto, id_externo,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, p_autor, p_texto, p_id_externo,
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  on conflict (atendimento_id, id_externo) where id_externo is not null do nothing;
  if not found then
    return 'duplicada';
  end if;
  return 'registrada';
end;
$$;

-- Name: reservar_anexo_para_envio(text, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if exists (
    select 1 from public.mensagens
    where anexo_caminho = p_caminho or anexo_miniatura_caminho = p_caminho
  ) then
    return 'em_uso';
  end if;
  insert into public.anexos_em_envio (caminho, atendimento_id)
  values (p_caminho, p_atendimento_id)
  on conflict (caminho) do nothing;
  if not found then
    return 'em_uso';
  end if;
  return 'reservado';
end;
$$;

-- Name: reservar_envio_automatico(uuid, text, interval); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval DEFAULT '00:15:00'::interval) RETURNS uuid
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

-- Name: reservar_guia_pgfn_para_envio(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.reservar_guia_pgfn_para_envio(p_parcelamento_id uuid, p_competencia text, p_caminho text) RETURNS uuid
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.cliente_parcelamento_guias
     set em_envio_ate = now() + interval '15 minutes', em_envio_token = gen_random_uuid()
   where parcelamento_id = p_parcelamento_id and competencia = p_competencia
     and arquivo_caminho = p_caminho and estado = 'confirmada'
     and (em_envio_ate is null or em_envio_ate <= now())
  returning em_envio_token;
$$;

-- Name: resolver_alerta_guia_pgfn_confirmada(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.resolver_alerta_guia_pgfn_confirmada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid;
begin
  select p.cliente_id into v_cliente_id
    from public.cliente_parcelamentos p where p.id = new.parcelamento_id;

  if jsonb_array_length(public.pendencias_guia_pgfn(v_cliente_id)) = 0 then
    update public.alertas_setor
       set resolvido_em = now()
     where cliente_id = v_cliente_id and origem = 'lembrete_pgfn' and resolvido_em is null;
  end if;
  return null;
end;
$$;

-- Name: resolver_alertas_setor_nao_renovados(timestamp with time zone, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.resolver_alertas_setor_nao_renovados(p_desde timestamp with time zone, p_origem text, p_cliente_ids uuid[]) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.alertas_setor
     set resolvido_em = now()
   where resolvido_em is null and criado_em < p_desde and tipo <> 'entrega_parcial'
     and origem = p_origem and cliente_id = any (p_cliente_ids);
$$;

-- Name: salvar_parcelamentos_cliente(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -

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

  insert into public.cliente_parcelamentos (
    id, cliente_id, codigo, parcelas_restantes, interno, arquivo_caminho,
    origem, total_parcelas, valor_parcela_centavos, data_adesao, criado_em
  )
  select (item ->> 'id')::uuid, p_cliente_id, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho',
         item #>> '{acordo,origem}', (item #>> '{acordo,totalDeParcelas}')::integer,
         (item #>> '{acordo,valorDaParcelaCentavos}')::integer, (item #>> '{acordo,dataDeAdesao}')::date,
         now() + ordem * interval '1 microsecond'
    from jsonb_array_elements(p_itens) with ordinality as it(item, ordem)
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;

-- Name: sou_responsavel_do_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_cadastro_operacional_sn
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  ) or exists (
    select 1 from public.cliente_responsaveis
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  );
$$;

-- Name: transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, public.setor_slug); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug) RETURNS jsonb
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
    select ct.nome into v_contato_nome
    from public.cliente_contatos ct
    where ct.cliente_id = v_atendimento.cliente_id
      and regexp_replace(ct.telefone, '\D', '', 'g') = v_atendimento.chave_telefone
    order by ct.padrao desc, ct.criado_em
    limit 1;
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

-- Name: validar_data_alteracao_contratual(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.validar_data_alteracao_contratual() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'alteracao_contratual_data_futura' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Name: alertas_setor; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.alertas_setor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setor public.setor_slug NOT NULL,
    tipo public.tipo_alerta_setor NOT NULL,
    cliente_id uuid NOT NULL,
    mensagem text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    resolvido_em timestamp with time zone,
    origem text DEFAULT 'lembretes'::text NOT NULL,
    CONSTRAINT alertas_setor_origem_check CHECK ((origem = ANY (ARRAY['lembretes'::text, 'parcelamento'::text, 'lembrete_pgfn'::text])))
);

-- Name: anexos_em_envio; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.anexos_em_envio (
    caminho text NOT NULL,
    atendimento_id uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: assuncoes_atendimento; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.assuncoes_atendimento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atendimento_id uuid NOT NULL,
    funcionario_id uuid NOT NULL,
    assumido_em timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

-- Name: atendimento_sessoes; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.atendimento_sessoes (
    chave text NOT NULL,
    etapa text NOT NULL,
    modo text,
    pagina integer,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    lista text,
    invalidos integer DEFAULT 0 NOT NULL,
    CONSTRAINT atendimento_sessoes_check CHECK (((etapa = 'alteracao'::text) = ((modo IS NOT NULL) AND (pagina IS NOT NULL) AND (lista IS NOT NULL)))),
    CONSTRAINT atendimento_sessoes_etapa_check CHECK ((etapa = ANY (ARRAY['tipo_documento'::text, 'alteracao'::text, 'ja_cliente'::text, 'cnpj'::text, 'cnpj_nova_tentativa'::text]))),
    CONSTRAINT atendimento_sessoes_invalidos_check CHECK ((invalidos >= 0)),
    CONSTRAINT atendimento_sessoes_modo_check CHECK ((modo = ANY (ARRAY['alteracoes'::text, 'ambos'::text]))),
    CONSTRAINT atendimento_sessoes_pagina_check CHECK ((pagina >= 1))
);

-- Name: atendimentos; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.atendimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telefone text NOT NULL,
    chave_telefone text NOT NULL,
    cliente_id uuid,
    setor public.setor_slug NOT NULL,
    funcionario_id uuid,
    status public.status_atendimento DEFAULT 'em_andamento'::public.status_atendimento NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    assumido_em timestamp with time zone,
    fila_funcionario_id uuid,
    fila_desde timestamp with time zone,
    resumo_ura text,
    cnpj_informado text,
    CONSTRAINT atendimentos_check CHECK (((funcionario_id IS NULL) = (assumido_em IS NULL))),
    CONSTRAINT atendimentos_cnpj_informado_check CHECK ((cnpj_informado ~ '^[0-9A-Z]{14}$'::text)),
    CONSTRAINT atendimentos_resumo_ura_check CHECK (((length(btrim(resumo_ura)) >= 1) AND (length(btrim(resumo_ura)) <= 1000)))
);

-- Name: cliente_alteracoes_contratuais; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_alteracoes_contratuais (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    data date NOT NULL,
    arquivo_caminho text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    numero integer NOT NULL,
    CONSTRAINT cliente_alteracoes_contratuais_numero_check CHECK ((numero > 0))
);

-- Name: cliente_atividades_mensais; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_atividades_mensais (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    ano_mes date NOT NULL,
    industria boolean DEFAULT false NOT NULL,
    comercio boolean DEFAULT false NOT NULL,
    servico boolean DEFAULT false NOT NULL,
    CONSTRAINT cliente_atividades_mensais_ano_mes_check CHECK ((EXTRACT(day FROM ano_mes) = (1)::numeric))
);

-- Name: cliente_cadastro_operacional_sn; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_cadastro_operacional_sn (
    cliente_id uuid NOT NULL,
    forma_envio public.forma_envio DEFAULT 'whatsapp'::public.forma_envio NOT NULL,
    documento_obrigatorio public.documento_obrigatorio_status,
    das_status public.das_status,
    data_envio_das date,
    observacoes_gerais text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    responsavel_id uuid,
    caminho_guia_das text
);

-- Name: cliente_contatos; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_contatos (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text NOT NULL,
    padrao boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: cliente_parcelamento_envios; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_parcelamento_envios (
    parcelamento_id uuid NOT NULL,
    parcela text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    identidade text,
    caminho text,
    CONSTRAINT cliente_parcelamento_envios_parcela_check CHECK ((parcela ~ '^[0-9]{6}$'::text))
);

-- Name: cliente_parcelamento_guias; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_parcelamento_guias (
    parcelamento_id uuid NOT NULL,
    competencia text NOT NULL,
    conta_negociacao text NOT NULL,
    arquivo_caminho text NOT NULL,
    estado public.guia_parcela_pgfn_estado DEFAULT 'a_confirmar'::public.guia_parcela_pgfn_estado NOT NULL,
    anexado_por uuid,
    anexado_em timestamp with time zone DEFAULT now() NOT NULL,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    motivo text,
    em_envio_ate timestamp with time zone,
    em_envio_token uuid,
    CONSTRAINT cliente_parcelamento_guias_competencia_check CHECK ((competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'::text)),
    CONSTRAINT cliente_parcelamento_guias_conta_check CHECK (((length(btrim(conta_negociacao)) >= 1) AND (length(btrim(conta_negociacao)) <= 40))),
    CONSTRAINT cliente_parcelamento_guias_motivo_check CHECK (((motivo IS NULL) OR (length(motivo) <= 300)))
);

-- Name: cliente_parcelamentos; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_parcelamentos (
    id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    codigo text NOT NULL,
    parcelas_restantes integer NOT NULL,
    interno boolean DEFAULT false NOT NULL,
    arquivo_caminho text NOT NULL,
    situacao public.parcelamento_situacao DEFAULT 'em_aberto'::public.parcelamento_situacao NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    origem text,
    total_parcelas integer,
    valor_parcela_centavos integer,
    data_adesao date,
    CONSTRAINT cliente_parcelamentos_codigo_check CHECK (((length(btrim(codigo)) >= 1) AND (length(btrim(codigo)) <= 60))),
    CONSTRAINT cliente_parcelamentos_origem_check CHECK ((origem = ANY (ARRAY['receita_federal'::text, 'pgfn'::text]))),
    CONSTRAINT cliente_parcelamentos_parcelas_restantes_check CHECK ((parcelas_restantes >= 0)),
    CONSTRAINT cliente_parcelamentos_total_parcelas_check CHECK ((total_parcelas >= 1)),
    CONSTRAINT cliente_parcelamentos_valor_parcela_check CHECK ((valor_parcela_centavos > 0))
);

-- Name: cliente_responsaveis; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cliente_responsaveis (
    cliente_id uuid NOT NULL,
    setor public.setor_slug NOT NULL,
    responsavel_id uuid NOT NULL,
    CONSTRAINT cliente_responsaveis_fora_do_sn CHECK ((setor <> 'simples_nacional'::public.setor_slug))
);

-- Name: clientes; Type: TABLE; Schema: public; Owner: -

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

-- Name: clientes_basico; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.clientes_basico WITH (security_invoker='false') AS
 SELECT id,
    empresa,
    cnpj,
    regime,
    email
   FROM public.clientes
  WHERE public.pode_ver_cliente(id);

-- Name: envios_automaticos; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.envios_automaticos (
    cliente_id uuid NOT NULL,
    tipo text NOT NULL,
    token uuid NOT NULL,
    reservado_em timestamp with time zone DEFAULT now() NOT NULL,
    concluido_em timestamp with time zone,
    CONSTRAINT envios_automaticos_tipo_check CHECK ((tipo = ANY (ARRAY['das'::text, 'parcelamento'::text])))
);

-- Name: feriados; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.feriados (
    data date NOT NULL,
    descricao text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feriados_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 200)))
);

-- Name: mensagens; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atendimento_id uuid NOT NULL,
    autor public.autor_mensagem NOT NULL,
    texto text NOT NULL,
    criado_em timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    funcionario_id uuid,
    id_externo text,
    reacao text,
    anexo_tipo text,
    anexo_nome text,
    anexo_caminho text,
    anexo_tamanho integer,
    anexo_miniatura_caminho text,
    entrega public.entrega_mensagem DEFAULT 'entregue'::public.entrega_mensagem NOT NULL,
    CONSTRAINT mensagens_anexo_completo CHECK ((((anexo_tipo IS NULL) AND (anexo_nome IS NULL) AND (anexo_caminho IS NULL) AND (anexo_tamanho IS NULL)) OR ((anexo_tipo = ANY (ARRAY['imagem'::text, 'audio'::text, 'documento'::text])) AND (anexo_nome IS NOT NULL) AND (length(btrim(anexo_nome)) > 0) AND (anexo_caminho IS NOT NULL) AND (length(btrim(anexo_caminho)) > 0) AND (anexo_tamanho IS NOT NULL) AND (anexo_tamanho > 0)))),
    CONSTRAINT mensagens_funcionario_so_do_funcionario CHECK (((autor = 'funcionario'::public.autor_mensagem) OR (funcionario_id IS NULL))),
    CONSTRAINT mensagens_reacao_check CHECK (((length(btrim(reacao)) >= 1) AND (length(btrim(reacao)) <= 16)))
);

-- Name: perfis; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.perfis (
    id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    papel public.papel NOT NULL,
    setor public.setor_slug NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    senha_trocada_em timestamp with time zone,
    senha_provisoria_expira_em timestamp with time zone DEFAULT (now() + '48:00:00'::interval) NOT NULL,
    senha_auth_alterada_em timestamp with time zone,
    desativado_em timestamp with time zone,
    banido_em timestamp with time zone
);

-- Name: registros_auditoria; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.registros_auditoria (
    id uuid NOT NULL,
    ator uuid NOT NULL,
    setor public.setor_slug NOT NULL,
    acao text NOT NULL,
    alvo text NOT NULL,
    resultado public.resultado_acao NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: transferencias; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.transferencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atendimento_id uuid NOT NULL,
    setor_origem public.setor_slug NOT NULL,
    funcionario_origem_id uuid,
    setor_destino public.setor_slug NOT NULL,
    funcionario_destino_id uuid,
    resumo text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transferencias_resumo_check CHECK (((length(btrim(resumo)) >= 1) AND (length(btrim(resumo)) <= 1000)))
);

-- Name: alertas_setor alertas_setor_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.alertas_setor
    ADD CONSTRAINT alertas_setor_pkey PRIMARY KEY (id);

-- Name: anexos_em_envio anexos_em_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.anexos_em_envio
    ADD CONSTRAINT anexos_em_envio_pkey PRIMARY KEY (caminho);

-- Name: assuncoes_atendimento assuncoes_atendimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_pkey PRIMARY KEY (id);

-- Name: atendimento_sessoes atendimento_sessoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.atendimento_sessoes
    ADD CONSTRAINT atendimento_sessoes_pkey PRIMARY KEY (chave);

-- Name: atendimentos atendimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_pkey PRIMARY KEY (id);

-- Name: avisos_cadastro avisos_cadastro_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.avisos_cadastro
    ADD CONSTRAINT avisos_cadastro_pkey PRIMARY KEY (id);

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_contratuais_cliente_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_alteracoes_contratuais
    ADD CONSTRAINT cliente_alteracoes_contratuais_cliente_id_numero_key UNIQUE (cliente_id, numero);

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_contratuais_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_alteracoes_contratuais
    ADD CONSTRAINT cliente_alteracoes_contratuais_pkey PRIMARY KEY (id);

-- Name: cliente_atividades_mensais cliente_atividades_mensais_cliente_id_ano_mes_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_cliente_id_ano_mes_key UNIQUE (cliente_id, ano_mes);

-- Name: cliente_atividades_mensais cliente_atividades_mensais_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_pkey PRIMARY KEY (id);

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_sn_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_pkey PRIMARY KEY (cliente_id);

-- Name: cliente_contatos cliente_contatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_pkey PRIMARY KEY (id);

-- Name: cliente_parcelamento_envios cliente_parcelamento_envios_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_envios
    ADD CONSTRAINT cliente_parcelamento_envios_pkey PRIMARY KEY (parcelamento_id, parcela);

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_guias
    ADD CONSTRAINT cliente_parcelamento_guias_pkey PRIMARY KEY (parcelamento_id, competencia);

-- Name: cliente_parcelamentos cliente_parcelamentos_cliente_id_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamentos
    ADD CONSTRAINT cliente_parcelamentos_cliente_id_codigo_key UNIQUE (cliente_id, codigo);

-- Name: cliente_parcelamentos cliente_parcelamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamentos
    ADD CONSTRAINT cliente_parcelamentos_pkey PRIMARY KEY (id);

-- Name: cliente_responsaveis cliente_responsaveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_responsaveis
    ADD CONSTRAINT cliente_responsaveis_pkey PRIMARY KEY (cliente_id, setor);

-- Name: clientes clientes_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_cnpj_key UNIQUE (cnpj);

-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);

-- Name: envios_automaticos envios_automaticos_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.envios_automaticos
    ADD CONSTRAINT envios_automaticos_pkey PRIMARY KEY (cliente_id, tipo);

-- Name: feriados feriados_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feriados
    ADD CONSTRAINT feriados_pkey PRIMARY KEY (data);

-- Name: mensagens mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_pkey PRIMARY KEY (id);

-- Name: perfis perfis_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_pkey PRIMARY KEY (id);

-- Name: registros_auditoria registros_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.registros_auditoria
    ADD CONSTRAINT registros_auditoria_pkey PRIMARY KEY (id);

-- Name: transferencias transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_pkey PRIMARY KEY (id);

-- Name: alertas_setor_um_aberto_por_cliente_tipo_e_origem; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX alertas_setor_um_aberto_por_cliente_tipo_e_origem ON public.alertas_setor USING btree (cliente_id, tipo, origem) WHERE (resolvido_em IS NULL);

-- Name: assuncoes_atendimento_funcionario_mes; Type: INDEX; Schema: public; Owner: -

CREATE INDEX assuncoes_atendimento_funcionario_mes ON public.assuncoes_atendimento USING btree (funcionario_id, assumido_em);

-- Name: atendimentos_em_andamento_telefone; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX atendimentos_em_andamento_telefone ON public.atendimentos USING btree (chave_telefone) WHERE (status = 'em_andamento'::public.status_atendimento);

-- Name: atendimentos_funcionario_mes; Type: INDEX; Schema: public; Owner: -

CREATE INDEX atendimentos_funcionario_mes ON public.atendimentos USING btree (funcionario_id, assumido_em);

-- Name: avisos_cadastro_nao_vistos_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX avisos_cadastro_nao_vistos_idx ON public.avisos_cadastro USING btree (destinatario_id) WHERE (visto_em IS NULL);

-- Name: cliente_contatos_cliente_id_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX cliente_contatos_cliente_id_idx ON public.cliente_contatos USING btree (cliente_id);

-- Name: cliente_contatos_um_padrao_por_cliente; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX cliente_contatos_um_padrao_por_cliente ON public.cliente_contatos USING btree (cliente_id) WHERE padrao;

-- Name: cliente_parcelamento_guias_arquivo_caminho_key; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX cliente_parcelamento_guias_arquivo_caminho_key ON public.cliente_parcelamento_guias USING btree (arquivo_caminho);

-- Name: cliente_parcelamentos_arquivo_caminho_key; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX cliente_parcelamentos_arquivo_caminho_key ON public.cliente_parcelamentos USING btree (arquivo_caminho);

-- Name: cliente_responsaveis_responsavel_idx; Type: INDEX; Schema: public; Owner: -

CREATE INDEX cliente_responsaveis_responsavel_idx ON public.cliente_responsaveis USING btree (responsavel_id);

-- Name: mensagens_atendimento; Type: INDEX; Schema: public; Owner: -

CREATE INDEX mensagens_atendimento ON public.mensagens USING btree (atendimento_id, criado_em);

-- Name: mensagens_atendimento_id_externo; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX mensagens_atendimento_id_externo ON public.mensagens USING btree (atendimento_id, id_externo) WHERE (id_externo IS NOT NULL);

-- Name: perfis_um_lider_ativo_por_setor; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX perfis_um_lider_ativo_por_setor ON public.perfis USING btree (setor) WHERE ((papel = 'lider_setor'::public.papel) AND (desativado_em IS NULL));

-- Name: transferencias_atendimento; Type: INDEX; Schema: public; Owner: -

CREATE INDEX transferencias_atendimento ON public.transferencias USING btree (atendimento_id, criado_em);

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_auditar_anexo; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_alteracoes_auditar_anexo AFTER INSERT ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.auditar_alteracao_contratual_anexada();

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_avisar_nova; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_alteracoes_avisar_nova AFTER INSERT ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.avisar_nova_alteracao();

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_data_nao_futura; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_alteracoes_data_nao_futura BEFORE INSERT OR UPDATE OF data ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.validar_data_alteracao_contratual();

-- Name: cliente_atividades_mensais cliente_atividades_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_atividades_auditar AFTER INSERT OR UPDATE ON public.cliente_atividades_mensais FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Name: cliente_atividades_mensais cliente_atividades_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_atividades_proteger BEFORE INSERT OR UPDATE ON public.cliente_atividades_mensais FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_auditar AFTER INSERT OR UPDATE OF forma_envio, documento_obrigatorio, das_status, data_envio_das, observacoes_gerais ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_auditar_responsavel; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_auditar_responsavel AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.auditar_responsavel_cliente();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_avisar_novo; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_avisar_novo AFTER INSERT ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_cliente_sn();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_proteger BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_proteger_das; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_proteger_das BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_das_enviado_do_sistema();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_proteger_responsavel; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_proteger_responsavel BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_responsavel_cliente();

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_reconciliar_esperas; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_cadastro_operacional_reconciliar_esperas AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_cadastro_operacional_sn FOR EACH ROW WHEN ((new.responsavel_id IS NOT NULL)) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

-- Name: cliente_contatos cliente_contatos_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_contatos_auditar AFTER INSERT OR DELETE ON public.cliente_contatos FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Name: cliente_contatos cliente_contatos_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_contatos_proteger BEFORE INSERT OR DELETE ON public.cliente_contatos FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

-- Name: cliente_parcelamento_envios cliente_parcelamento_envios_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamento_envios_proteger BEFORE INSERT OR DELETE OR UPDATE ON public.cliente_parcelamento_envios FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_envio();

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamento_guias_auditar AFTER INSERT OR DELETE OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_parcelamento_guia();

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamento_guias_proteger BEFORE INSERT OR DELETE OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_guia();

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_proteger_caminho; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamento_guias_proteger_caminho BEFORE INSERT OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_guia_caminho();

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_resolver_alerta; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamento_guias_resolver_alerta AFTER INSERT OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW WHEN ((new.estado = 'confirmada'::public.guia_parcela_pgfn_estado)) EXECUTE FUNCTION public.resolver_alerta_guia_pgfn_confirmada();

-- Name: cliente_parcelamentos cliente_parcelamentos_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamentos_auditar AFTER INSERT OR DELETE OR UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Name: cliente_parcelamentos cliente_parcelamentos_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamentos_proteger BEFORE INSERT OR DELETE OR UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cadastro_operacional();

-- Name: cliente_parcelamentos cliente_parcelamentos_proteger_anexo; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamentos_proteger_anexo BEFORE INSERT ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_anexo();

-- Name: cliente_parcelamentos cliente_parcelamentos_proteger_pgfn; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamentos_proteger_pgfn BEFORE UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_pgfn();

-- Name: cliente_parcelamentos cliente_parcelamentos_proteger_sistema; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_parcelamentos_proteger_sistema BEFORE INSERT OR DELETE OR UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento();

-- Name: cliente_responsaveis cliente_responsaveis_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_responsaveis_auditar AFTER INSERT OR DELETE OR UPDATE ON public.cliente_responsaveis FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_responsavel();

-- Name: cliente_responsaveis cliente_responsaveis_proteger; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_responsaveis_proteger BEFORE INSERT OR UPDATE ON public.cliente_responsaveis FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_responsavel();

-- Name: cliente_responsaveis cliente_responsaveis_reconciliar_esperas; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER cliente_responsaveis_reconciliar_esperas AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_responsaveis FOR EACH ROW WHEN ((new.responsavel_id IS NOT NULL)) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

-- Name: clientes clientes_auditar_criacao; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER clientes_auditar_criacao AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_criado();

-- Name: feriados feriados_auditar; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER feriados_auditar AFTER INSERT OR DELETE ON public.feriados FOR EACH ROW EXECUTE FUNCTION public.auditar_feriado();

-- Name: perfis perfis_lider_reconciliar_esperas; Type: TRIGGER; Schema: public; Owner: -

CREATE TRIGGER perfis_lider_reconciliar_esperas AFTER INSERT OR UPDATE OF papel, setor, desativado_em ON public.perfis FOR EACH ROW WHEN (((new.papel = 'lider_setor'::public.papel) AND (new.desativado_em IS NULL))) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

-- Name: alertas_setor alertas_setor_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.alertas_setor
    ADD CONSTRAINT alertas_setor_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: anexos_em_envio anexos_em_envio_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.anexos_em_envio
    ADD CONSTRAINT anexos_em_envio_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

-- Name: assuncoes_atendimento assuncoes_atendimento_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

-- Name: assuncoes_atendimento assuncoes_atendimento_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

-- Name: atendimentos atendimentos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);

-- Name: atendimentos atendimentos_fila_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_fila_funcionario_id_fkey FOREIGN KEY (fila_funcionario_id) REFERENCES public.perfis(id);

-- Name: atendimentos atendimentos_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

-- Name: avisos_cadastro avisos_cadastro_alteracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.avisos_cadastro
    ADD CONSTRAINT avisos_cadastro_alteracao_id_fkey FOREIGN KEY (alteracao_id) REFERENCES public.cliente_alteracoes_contratuais(id) ON DELETE CASCADE;

-- Name: avisos_cadastro avisos_cadastro_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.avisos_cadastro
    ADD CONSTRAINT avisos_cadastro_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: avisos_cadastro avisos_cadastro_destinatario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.avisos_cadastro
    ADD CONSTRAINT avisos_cadastro_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES public.perfis(id) ON DELETE CASCADE;

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_contratuais_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_alteracoes_contratuais
    ADD CONSTRAINT cliente_alteracoes_contratuais_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_atividades_mensais cliente_atividades_mensais_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_atividades_mensais
    ADD CONSTRAINT cliente_atividades_mensais_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_sn_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_sn_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_cadastro_operacional_sn
    ADD CONSTRAINT cliente_cadastro_operacional_sn_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.perfis(id) ON DELETE SET NULL;

-- Name: cliente_contatos cliente_contatos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_parcelamento_envios cliente_parcelamento_envios_parcelamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_envios
    ADD CONSTRAINT cliente_parcelamento_envios_parcelamento_id_fkey FOREIGN KEY (parcelamento_id) REFERENCES public.cliente_parcelamentos(id) ON DELETE CASCADE;

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_anexado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_guias
    ADD CONSTRAINT cliente_parcelamento_guias_anexado_por_fkey FOREIGN KEY (anexado_por) REFERENCES public.perfis(id) ON DELETE SET NULL;

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_guias
    ADD CONSTRAINT cliente_parcelamento_guias_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES public.perfis(id) ON DELETE SET NULL;

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_parcelamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamento_guias
    ADD CONSTRAINT cliente_parcelamento_guias_parcelamento_id_fkey FOREIGN KEY (parcelamento_id) REFERENCES public.cliente_parcelamentos(id) ON DELETE CASCADE;

-- Name: cliente_parcelamentos cliente_parcelamentos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_parcelamentos
    ADD CONSTRAINT cliente_parcelamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_responsaveis cliente_responsaveis_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_responsaveis
    ADD CONSTRAINT cliente_responsaveis_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: cliente_responsaveis cliente_responsaveis_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cliente_responsaveis
    ADD CONSTRAINT cliente_responsaveis_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.perfis(id) ON DELETE CASCADE;

-- Name: envios_automaticos envios_automaticos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.envios_automaticos
    ADD CONSTRAINT envios_automaticos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Name: mensagens mensagens_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

-- Name: mensagens mensagens_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

-- Name: perfis perfis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: transferencias transferencias_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

-- Name: transferencias transferencias_funcionario_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_funcionario_destino_id_fkey FOREIGN KEY (funcionario_destino_id) REFERENCES public.perfis(id);

-- Name: transferencias transferencias_funcionario_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_funcionario_origem_id_fkey FOREIGN KEY (funcionario_origem_id) REFERENCES public.perfis(id);

-- Name: alertas_setor; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.alertas_setor ENABLE ROW LEVEL SECURITY;

-- Name: alertas_setor alertas_setor_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY alertas_setor_select ON public.alertas_setor FOR SELECT TO authenticated USING ((public.acesso_liberado() AND ((public.meu_papel() = 'admin'::public.papel) OR (setor = public.meu_setor()))));

-- Name: anexos_em_envio; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.anexos_em_envio ENABLE ROW LEVEL SECURITY;

-- Name: assuncoes_atendimento; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.assuncoes_atendimento ENABLE ROW LEVEL SECURITY;

-- Name: atendimento_sessoes; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.atendimento_sessoes ENABLE ROW LEVEL SECURITY;

-- Name: atendimentos; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

-- Name: avisos_cadastro; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.avisos_cadastro ENABLE ROW LEVEL SECURITY;

-- Name: avisos_cadastro avisos_cadastro_select_proprio; Type: POLICY; Schema: public; Owner: -

CREATE POLICY avisos_cadastro_select_proprio ON public.avisos_cadastro FOR SELECT TO authenticated USING ((destinatario_id = auth.uid()));

-- Name: cliente_alteracoes_contratuais; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_alteracoes_contratuais ENABLE ROW LEVEL SECURITY;

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_insert_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_alteracoes_insert_admin ON public.cliente_alteracoes_contratuais FOR INSERT TO authenticated WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

-- Name: cliente_alteracoes_contratuais cliente_alteracoes_select_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_alteracoes_select_admin ON public.cliente_alteracoes_contratuais FOR SELECT TO authenticated USING ((public.meu_papel() = 'admin'::public.papel));

-- Name: cliente_atividades_mensais; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_atividades_mensais ENABLE ROW LEVEL SECURITY;

-- Name: cliente_atividades_mensais cliente_atividades_select_qualquer_perfil; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_atividades_select_qualquer_perfil ON public.cliente_atividades_mensais FOR SELECT TO authenticated USING (public.pode_ver_cliente(cliente_id));

-- Name: cliente_atividades_mensais cliente_atividades_update_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_atividades_update_sn ON public.cliente_atividades_mensais FOR UPDATE TO authenticated USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_atividades_mensais cliente_atividades_upsert_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_atividades_upsert_sn ON public.cliente_atividades_mensais FOR INSERT TO authenticated WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_select_qualquer_perfil; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_cadastro_operacional_select_qualquer_perfil ON public.cliente_cadastro_operacional_sn FOR SELECT TO authenticated USING (public.pode_ver_cliente(cliente_id));

-- Name: cliente_cadastro_operacional_sn; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_cadastro_operacional_sn ENABLE ROW LEVEL SECURITY;

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_update_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_cadastro_operacional_update_sn ON public.cliente_cadastro_operacional_sn FOR UPDATE TO authenticated USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_cadastro_operacional_sn cliente_cadastro_operacional_upsert_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_cadastro_operacional_upsert_sn ON public.cliente_cadastro_operacional_sn FOR INSERT TO authenticated WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_contatos; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_contatos ENABLE ROW LEVEL SECURITY;

-- Name: cliente_contatos cliente_contatos_delete_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_contatos_delete_sn ON public.cliente_contatos FOR DELETE TO authenticated USING (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_contatos cliente_contatos_insert_sn; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_contatos_insert_sn ON public.cliente_contatos FOR INSERT TO authenticated WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_contatos cliente_contatos_select_qualquer_perfil; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_contatos_select_qualquer_perfil ON public.cliente_contatos FOR SELECT TO authenticated USING (public.pode_ver_cliente(cliente_id));

-- Name: cliente_parcelamento_envios; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_parcelamento_envios ENABLE ROW LEVEL SECURITY;

-- Name: cliente_parcelamento_envios cliente_parcelamento_envios_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamento_envios_select ON public.cliente_parcelamento_envios FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE (p.id = cliente_parcelamento_envios.parcelamento_id))));

-- Name: cliente_parcelamento_guias; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_parcelamento_guias ENABLE ROW LEVEL SECURITY;

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_delete; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_editar_cadastro_operacional(p.cliente_id)))));

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_editar_cadastro_operacional(p.cliente_id)))));

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamento_guias_select ON public.cliente_parcelamento_guias FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE (p.id = cliente_parcelamento_guias.parcelamento_id))));

-- Name: cliente_parcelamento_guias cliente_parcelamento_guias_update; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_editar_cadastro_operacional(p.cliente_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_editar_cadastro_operacional(p.cliente_id)))));

-- Name: cliente_parcelamentos; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_parcelamentos ENABLE ROW LEVEL SECURITY;

-- Name: cliente_parcelamentos cliente_parcelamentos_delete; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos FOR DELETE USING (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_parcelamentos cliente_parcelamentos_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos FOR INSERT WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_parcelamentos cliente_parcelamentos_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos FOR SELECT USING (public.pode_ver_cliente(cliente_id));

-- Name: cliente_parcelamentos cliente_parcelamentos_update; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos FOR UPDATE USING (public.pode_editar_cadastro_operacional(cliente_id)) WITH CHECK (public.pode_editar_cadastro_operacional(cliente_id));

-- Name: cliente_responsaveis; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.cliente_responsaveis ENABLE ROW LEVEL SECURITY;

-- Name: cliente_responsaveis cliente_responsaveis_delete; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_responsaveis_delete ON public.cliente_responsaveis FOR DELETE USING ((public.acesso_liberado() AND (public.meu_papel() = 'lider_setor'::public.papel) AND (public.meu_setor() = setor)));

-- Name: cliente_responsaveis cliente_responsaveis_insert; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_responsaveis_insert ON public.cliente_responsaveis FOR INSERT WITH CHECK ((public.acesso_liberado() AND (public.meu_papel() = 'lider_setor'::public.papel) AND (public.meu_setor() = setor)));

-- Name: cliente_responsaveis cliente_responsaveis_select; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_responsaveis_select ON public.cliente_responsaveis FOR SELECT USING ((public.acesso_liberado() AND ((public.meu_papel() = 'admin'::public.papel) OR ((public.meu_papel() = 'lider_setor'::public.papel) AND (public.meu_setor() = setor)) OR (responsavel_id = auth.uid()))));

-- Name: cliente_responsaveis cliente_responsaveis_update; Type: POLICY; Schema: public; Owner: -

CREATE POLICY cliente_responsaveis_update ON public.cliente_responsaveis FOR UPDATE USING ((public.acesso_liberado() AND (public.meu_papel() = 'lider_setor'::public.papel) AND (public.meu_setor() = setor))) WITH CHECK ((public.acesso_liberado() AND (public.meu_papel() = 'lider_setor'::public.papel) AND (public.meu_setor() = setor)));

-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Name: clientes clientes_insert_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY clientes_insert_admin ON public.clientes FOR INSERT TO authenticated WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

-- Name: clientes clientes_select_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY clientes_select_admin ON public.clientes FOR SELECT TO authenticated USING ((public.meu_papel() = 'admin'::public.papel));

-- Name: envios_automaticos; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.envios_automaticos ENABLE ROW LEVEL SECURITY;

-- Name: feriados; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- Name: feriados feriados_delete_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY feriados_delete_admin ON public.feriados FOR DELETE TO authenticated USING ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

-- Name: feriados feriados_insert_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY feriados_insert_admin ON public.feriados FOR INSERT TO authenticated WITH CHECK ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

-- Name: feriados feriados_select_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY feriados_select_admin ON public.feriados FOR SELECT TO authenticated USING ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

-- Name: mensagens; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Name: perfis; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Name: perfis perfis_insert_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY perfis_insert_admin ON public.perfis FOR INSERT TO authenticated WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

-- Name: perfis perfis_insert_lider_proprio_setor; Type: POLICY; Schema: public; Owner: -

CREATE POLICY perfis_insert_lider_proprio_setor ON public.perfis FOR INSERT TO authenticated WITH CHECK (((public.meu_papel() = 'lider_setor'::public.papel) AND (papel = 'funcionario'::public.papel) AND (setor = public.meu_setor())));

-- Name: perfis perfis_select_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY perfis_select_admin ON public.perfis FOR SELECT TO authenticated USING ((public.meu_papel() = 'admin'::public.papel));

-- Name: perfis perfis_select_mesmo_setor; Type: POLICY; Schema: public; Owner: -

CREATE POLICY perfis_select_mesmo_setor ON public.perfis FOR SELECT TO authenticated USING ((setor = public.meu_setor()));

-- Name: perfis perfis_select_proprio; Type: POLICY; Schema: public; Owner: -

CREATE POLICY perfis_select_proprio ON public.perfis FOR SELECT TO authenticated USING ((id = auth.uid()));

-- Name: registros_auditoria; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.registros_auditoria ENABLE ROW LEVEL SECURITY;

-- Name: registros_auditoria registros_auditoria_select_admin; Type: POLICY; Schema: public; Owner: -

CREATE POLICY registros_auditoria_select_admin ON public.registros_auditoria FOR SELECT TO authenticated USING ((public.meu_papel() = 'admin'::public.papel));

-- Name: transferencias; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Name: FUNCTION abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text, p_cnpj_informado text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text, p_cnpj_informado text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text, p_cnpj_informado text) TO service_role;

-- Name: FUNCTION acesso_liberado(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.acesso_liberado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acesso_liberado() TO authenticated;
GRANT ALL ON FUNCTION public.acesso_liberado() TO service_role;

-- Name: FUNCTION alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel) TO service_role;

-- Name: FUNCTION anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text) TO authenticated;
GRANT ALL ON FUNCTION public.anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text) TO service_role;

-- Name: FUNCTION anexar_mensagem_atendimento(p_chave text, p_autor public.autor_mensagem, p_texto text, p_id_externo text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.anexar_mensagem_atendimento(p_chave text, p_autor public.autor_mensagem, p_texto text, p_id_externo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anexar_mensagem_atendimento(p_chave text, p_autor public.autor_mensagem, p_texto text, p_id_externo text) TO service_role;

-- Name: FUNCTION assumir_atendimento(p_atendimento_id uuid, p_ator uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.assumir_atendimento(p_atendimento_id uuid, p_ator uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assumir_atendimento(p_atendimento_id uuid, p_ator uuid) TO service_role;

-- Name: FUNCTION atendente_elegivel(p_funcionario uuid, p_setor public.setor_slug); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.atendente_elegivel(p_funcionario uuid, p_setor public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.atendente_elegivel(p_funcionario uuid, p_setor public.setor_slug) TO service_role;

-- Name: FUNCTION auditar_alteracao_contratual_anexada(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_alteracao_contratual_anexada() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_alteracao_contratual_anexada() TO service_role;

-- Name: FUNCTION auditar_cadastro_operacional_editado(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_cadastro_operacional_editado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_cadastro_operacional_editado() TO service_role;

-- Name: FUNCTION auditar_cliente_criado(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_cliente_criado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_cliente_criado() TO service_role;

-- Name: FUNCTION auditar_cliente_parcelamento_guia(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_cliente_parcelamento_guia() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_cliente_parcelamento_guia() TO service_role;

-- Name: FUNCTION auditar_cliente_responsavel(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_cliente_responsavel() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_cliente_responsavel() TO service_role;

-- Name: FUNCTION auditar_das_da_ura(p_cliente_id uuid, p_acao text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_das_da_ura(p_cliente_id uuid, p_acao text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_das_da_ura(p_cliente_id uuid, p_acao text) TO service_role;

-- Name: FUNCTION auditar_feriado(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_feriado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_feriado() TO service_role;

-- Name: FUNCTION auditar_responsavel_cliente(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.auditar_responsavel_cliente() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auditar_responsavel_cliente() TO service_role;

-- Name: FUNCTION avisar_nova_alteracao(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.avisar_nova_alteracao() FROM PUBLIC;
GRANT ALL ON FUNCTION public.avisar_nova_alteracao() TO service_role;

-- Name: FUNCTION avisar_novo_cliente_sn(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.avisar_novo_cliente_sn() FROM PUBLIC;
GRANT ALL ON FUNCTION public.avisar_novo_cliente_sn() TO service_role;

-- Name: FUNCTION cliente_tem_parcelamento_pendente(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION clientes_com_parcelamento_pgfn(p_apos uuid, p_limite integer); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.clientes_com_parcelamento_pgfn(p_apos uuid, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clientes_com_parcelamento_pgfn(p_apos uuid, p_limite integer) TO service_role;

-- Name: FUNCTION clientes_para_envio_base(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.clientes_para_envio_base() FROM PUBLIC;
GRANT ALL ON FUNCTION public.clientes_para_envio_base() TO service_role;

-- Name: FUNCTION clientes_para_lembrete(p_apos uuid, p_limite integer); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.clientes_para_lembrete(p_apos uuid, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clientes_para_lembrete(p_apos uuid, p_limite integer) TO service_role;

-- Name: FUNCTION clientes_para_parcelamento(p_apos uuid, p_limite integer); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.clientes_para_parcelamento(p_apos uuid, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clientes_para_parcelamento(p_apos uuid, p_limite integer) TO service_role;

-- Name: FUNCTION concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date, p_caminho text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date, p_caminho text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date, p_caminho text) TO service_role;

-- Name: FUNCTION concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) TO service_role;

-- Name: FUNCTION criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.criar_cliente(p_id uuid, p_empresa text, p_cnpj text, p_regime public.regime, p_contrato_social_caminho text, p_alteracoes jsonb, p_email text) TO service_role;

-- Name: FUNCTION desativar_usuario(alvo_id uuid, ator_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) TO service_role;

-- Name: FUNCTION destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug) TO service_role;

-- Name: FUNCTION documentos_contratuais_do_cliente(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.documentos_contratuais_do_cliente(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.documentos_contratuais_do_cliente(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.documentos_contratuais_do_cliente(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) TO authenticated;
GRANT ALL ON FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) TO service_role;

-- Name: FUNCTION encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) TO service_role;

-- Name: FUNCTION encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid) TO authenticated;
GRANT ALL ON FUNCTION public.encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid) TO service_role;

-- Name: FUNCTION fila_do_setor(p_setor public.setor_slug); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.fila_do_setor(p_setor public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fila_do_setor(p_setor public.setor_slug) TO service_role;

-- Name: FUNCTION finalizar_entrega_mensagem_do_funcionario(p_id uuid, p_entregue boolean); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.finalizar_entrega_mensagem_do_funcionario(p_id uuid, p_entregue boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalizar_entrega_mensagem_do_funcionario(p_id uuid, p_entregue boolean) TO service_role;

-- Name: FUNCTION finalizar_troca_senha(usuario_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.finalizar_troca_senha(usuario_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalizar_troca_senha(usuario_id uuid) TO service_role;

-- Name: FUNCTION identificar_contato_por_telefone(p_telefone text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.identificar_contato_por_telefone(p_telefone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.identificar_contato_por_telefone(p_telefone text) TO service_role;

-- Name: FUNCTION liberar_anexo_em_envio(p_caminho text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.liberar_anexo_em_envio(p_caminho text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.liberar_anexo_em_envio(p_caminho text) TO service_role;

-- Name: FUNCTION liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid) TO service_role;

-- Name: FUNCTION liberar_guia_pgfn_do_envio(p_parcelamento_id uuid, p_competencia text, p_token uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.liberar_guia_pgfn_do_envio(p_parcelamento_id uuid, p_competencia text, p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.liberar_guia_pgfn_do_envio(p_parcelamento_id uuid, p_competencia text, p_token uuid) TO service_role;

-- Name: TABLE avisos_cadastro; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.avisos_cadastro TO service_role;
GRANT SELECT ON TABLE public.avisos_cadastro TO authenticated;

-- Name: FUNCTION listar_avisos_cadastro(p_limite integer, p_cursor_visto boolean, p_cursor_criado_em timestamp with time zone, p_cursor_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.listar_avisos_cadastro(p_limite integer, p_cursor_visto boolean, p_cursor_criado_em timestamp with time zone, p_cursor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.listar_avisos_cadastro(p_limite integer, p_cursor_visto boolean, p_cursor_criado_em timestamp with time zone, p_cursor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.listar_avisos_cadastro(p_limite integer, p_cursor_visto boolean, p_cursor_criado_em timestamp with time zone, p_cursor_id uuid) TO service_role;

-- Name: FUNCTION marcar_aviso_visto(p_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.marcar_aviso_visto(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_aviso_visto(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.marcar_aviso_visto(p_id uuid) TO service_role;

-- Name: FUNCTION mes_corrente_sp(p_agora timestamp with time zone); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.mes_corrente_sp(p_agora timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mes_corrente_sp(p_agora timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.mes_corrente_sp(p_agora timestamp with time zone) TO service_role;

-- Name: FUNCTION meu_papel(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.meu_papel() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meu_papel() TO authenticated;
GRANT ALL ON FUNCTION public.meu_papel() TO service_role;

-- Name: FUNCTION meu_setor(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.meu_setor() FROM PUBLIC;
GRANT ALL ON FUNCTION public.meu_setor() TO authenticated;
GRANT ALL ON FUNCTION public.meu_setor() TO service_role;

-- Name: FUNCTION pendencias_guia_pgfn(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.pendencias_guia_pgfn(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pendencias_guia_pgfn(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION pode_anexar_ao_atendimento(p_atendimento text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.pode_anexar_ao_atendimento(p_atendimento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_anexar_ao_atendimento(p_atendimento text) TO authenticated;
GRANT ALL ON FUNCTION public.pode_anexar_ao_atendimento(p_atendimento text) TO service_role;

-- Name: FUNCTION pode_editar_cadastro_operacional(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.pode_editar_cadastro_operacional(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_editar_cadastro_operacional(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pode_editar_cadastro_operacional(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION pode_ver_cliente(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.pode_ver_cliente(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_ver_cliente(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pode_ver_cliente(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION pode_ver_documentos_contratuais(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION proteger_cadastro_operacional(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cadastro_operacional() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cadastro_operacional() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento_anexo(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_anexo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_anexo() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento_envio(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_envio() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_envio() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento_guia(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_guia() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_guia() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento_guia_caminho(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_guia_caminho() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_guia_caminho() TO service_role;

-- Name: FUNCTION proteger_cliente_parcelamento_pgfn(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_parcelamento_pgfn() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_parcelamento_pgfn() TO service_role;

-- Name: FUNCTION proteger_cliente_responsavel(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_cliente_responsavel() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_cliente_responsavel() TO service_role;

-- Name: FUNCTION proteger_das_enviado_do_sistema(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_das_enviado_do_sistema() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_das_enviado_do_sistema() TO authenticated;
GRANT ALL ON FUNCTION public.proteger_das_enviado_do_sistema() TO service_role;

-- Name: FUNCTION proteger_responsavel_cliente(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.proteger_responsavel_cliente() FROM PUBLIC;
GRANT ALL ON FUNCTION public.proteger_responsavel_cliente() TO authenticated;
GRANT ALL ON FUNCTION public.proteger_responsavel_cliente() TO service_role;

-- Name: FUNCTION reconciliar_esperas_ao_surgir_destinatario(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.reconciliar_esperas_ao_surgir_destinatario() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reconciliar_esperas_ao_surgir_destinatario() TO service_role;

-- Name: FUNCTION reconciliar_esperas_sem_destinatario(p_setor public.setor_slug, p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.reconciliar_esperas_sem_destinatario(p_setor public.setor_slug, p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reconciliar_esperas_sem_destinatario(p_setor public.setor_slug, p_cliente_id uuid) TO service_role;

-- Name: FUNCTION regime_tem_cadastro_operacional_sn(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.regime_tem_cadastro_operacional_sn(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regime_tem_cadastro_operacional_sn(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regime_tem_cadastro_operacional_sn(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION registrar_acao_auditoria(p_id uuid, p_ator uuid, p_setor public.setor_slug, p_acao text, p_alvo text, p_resultado public.resultado_acao); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_acao_auditoria(p_id uuid, p_ator uuid, p_setor public.setor_slug, p_acao text, p_alvo text, p_resultado public.resultado_acao) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_acao_auditoria(p_id uuid, p_ator uuid, p_setor public.setor_slug, p_acao text, p_alvo text, p_resultado public.resultado_acao) TO service_role;

-- Name: FUNCTION registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text) TO service_role;

-- Name: FUNCTION registrar_auth_senha_alterada(usuario_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_auth_senha_alterada(usuario_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_auth_senha_alterada(usuario_id uuid) TO service_role;

-- Name: FUNCTION registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text, p_caminho text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text, p_caminho text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text, p_caminho text) TO service_role;

-- Name: FUNCTION registrar_mensagem_do_funcionario(p_atendimento_id uuid, p_ator uuid, p_texto text, p_anexo jsonb); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_mensagem_do_funcionario(p_atendimento_id uuid, p_ator uuid, p_texto text, p_anexo jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_mensagem_do_funcionario(p_atendimento_id uuid, p_ator uuid, p_texto text, p_anexo jsonb) TO service_role;

-- Name: FUNCTION registrar_mensagem_recebida(p_atendimento_id uuid, p_autor public.autor_mensagem, p_texto text, p_id_externo text, p_anexo jsonb); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.registrar_mensagem_recebida(p_atendimento_id uuid, p_autor public.autor_mensagem, p_texto text, p_id_externo text, p_anexo jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_mensagem_recebida(p_atendimento_id uuid, p_autor public.autor_mensagem, p_texto text, p_id_externo text, p_anexo jsonb) TO service_role;

-- Name: FUNCTION reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid) TO service_role;

-- Name: FUNCTION reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval) TO service_role;

-- Name: FUNCTION reservar_guia_pgfn_para_envio(p_parcelamento_id uuid, p_competencia text, p_caminho text); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.reservar_guia_pgfn_para_envio(p_parcelamento_id uuid, p_competencia text, p_caminho text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reservar_guia_pgfn_para_envio(p_parcelamento_id uuid, p_competencia text, p_caminho text) TO service_role;

-- Name: FUNCTION resolver_alerta_guia_pgfn_confirmada(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.resolver_alerta_guia_pgfn_confirmada() FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolver_alerta_guia_pgfn_confirmada() TO service_role;

-- Name: FUNCTION resolver_alertas_setor_nao_renovados(p_desde timestamp with time zone, p_origem text, p_cliente_ids uuid[]); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.resolver_alertas_setor_nao_renovados(p_desde timestamp with time zone, p_origem text, p_cliente_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolver_alertas_setor_nao_renovados(p_desde timestamp with time zone, p_origem text, p_cliente_ids uuid[]) TO service_role;

-- Name: FUNCTION salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb) TO service_role;

-- Name: FUNCTION sou_responsavel_do_cliente(p_cliente_id uuid); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente(p_cliente_id uuid) TO service_role;

-- Name: FUNCTION transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_dirigido_a uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_setor_origem public.setor_slug) TO service_role;

-- Name: FUNCTION validar_data_alteracao_contratual(); Type: ACL; Schema: public; Owner: -

REVOKE ALL ON FUNCTION public.validar_data_alteracao_contratual() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validar_data_alteracao_contratual() TO service_role;

-- Name: TABLE alertas_setor; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.alertas_setor TO authenticated;
GRANT ALL ON TABLE public.alertas_setor TO service_role;

-- Name: TABLE anexos_em_envio; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.anexos_em_envio TO service_role;

-- Name: TABLE assuncoes_atendimento; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.assuncoes_atendimento TO service_role;

-- Name: TABLE atendimento_sessoes; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.atendimento_sessoes TO service_role;

-- Name: TABLE atendimentos; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.atendimentos TO service_role;

-- Name: TABLE cliente_alteracoes_contratuais; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cliente_alteracoes_contratuais TO authenticated;
GRANT ALL ON TABLE public.cliente_alteracoes_contratuais TO service_role;

-- Name: TABLE cliente_atividades_mensais; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cliente_atividades_mensais TO authenticated;
GRANT ALL ON TABLE public.cliente_atividades_mensais TO service_role;

-- Name: TABLE cliente_cadastro_operacional_sn; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cliente_cadastro_operacional_sn TO authenticated;
GRANT ALL ON TABLE public.cliente_cadastro_operacional_sn TO service_role;

-- Name: TABLE cliente_contatos; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cliente_contatos TO authenticated;
GRANT ALL ON TABLE public.cliente_contatos TO service_role;

-- Name: TABLE cliente_parcelamento_envios; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.cliente_parcelamento_envios TO authenticated;
GRANT ALL ON TABLE public.cliente_parcelamento_envios TO service_role;

-- Name: TABLE cliente_parcelamento_guias; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.cliente_parcelamento_guias TO authenticated;
GRANT ALL ON TABLE public.cliente_parcelamento_guias TO service_role;

-- Name: COLUMN cliente_parcelamento_guias.conta_negociacao; Type: ACL; Schema: public; Owner: -

GRANT UPDATE(conta_negociacao) ON TABLE public.cliente_parcelamento_guias TO authenticated;

-- Name: COLUMN cliente_parcelamento_guias.arquivo_caminho; Type: ACL; Schema: public; Owner: -

GRANT UPDATE(arquivo_caminho) ON TABLE public.cliente_parcelamento_guias TO authenticated;

-- Name: COLUMN cliente_parcelamento_guias.estado; Type: ACL; Schema: public; Owner: -

GRANT UPDATE(estado) ON TABLE public.cliente_parcelamento_guias TO authenticated;

-- Name: COLUMN cliente_parcelamento_guias.motivo; Type: ACL; Schema: public; Owner: -

GRANT UPDATE(motivo) ON TABLE public.cliente_parcelamento_guias TO authenticated;

-- Name: TABLE cliente_parcelamentos; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.cliente_parcelamentos TO authenticated;
GRANT ALL ON TABLE public.cliente_parcelamentos TO service_role;

-- Name: TABLE cliente_responsaveis; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.cliente_responsaveis TO authenticated;
GRANT ALL ON TABLE public.cliente_responsaveis TO service_role;

-- Name: TABLE clientes; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.clientes TO authenticated;
GRANT ALL ON TABLE public.clientes TO service_role;

-- Name: TABLE clientes_basico; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.clientes_basico TO service_role;
GRANT SELECT ON TABLE public.clientes_basico TO authenticated;

-- Name: TABLE envios_automaticos; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.envios_automaticos TO authenticated;
GRANT ALL ON TABLE public.envios_automaticos TO service_role;

-- Name: TABLE feriados; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.feriados TO authenticated;
GRANT ALL ON TABLE public.feriados TO service_role;

-- Name: TABLE mensagens; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.mensagens TO service_role;

-- Name: TABLE perfis; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.perfis TO authenticated;
GRANT ALL ON TABLE public.perfis TO service_role;

-- Name: TABLE registros_auditoria; Type: ACL; Schema: public; Owner: -

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.registros_auditoria TO authenticated;
GRANT ALL ON TABLE public.registros_auditoria TO service_role;

-- Name: TABLE transferencias; Type: ACL; Schema: public; Owner: -

GRANT ALL ON TABLE public.transferencias TO service_role;

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documentos-clientes', 'documentos-clientes', 'f', '10485760', '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('guias-fiscais', 'guias-fiscais', 'f', '10485760', '{application/pdf}');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('anexos-atendimento', 'anexos-atendimento', 'f', '10485760', '{image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-zip-compressed,audio/ogg,audio/mp4,audio/webm}');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('parcelamentos-clientes', 'parcelamentos-clientes', 'f', '10485760', '{application/pdf}');

create policy anexos_atendimento_envio_do_funcionario on storage.objects as permissive for INSERT to authenticated  with check (((bucket_id = 'anexos-atendimento'::text) AND pode_anexar_ao_atendimento((storage.foldername(name))[1])));
create policy documentos_clientes_delete_admin on storage.objects as permissive for DELETE to authenticated using (((bucket_id = 'documentos-clientes'::text) AND (meu_papel() = 'admin'::papel))) ;
create policy documentos_clientes_insert_admin on storage.objects as permissive for INSERT to authenticated  with check (((bucket_id = 'documentos-clientes'::text) AND (meu_papel() = 'admin'::papel)));
create policy documentos_clientes_select_admin on storage.objects as permissive for SELECT to authenticated using (((bucket_id = 'documentos-clientes'::text) AND (meu_papel() = 'admin'::papel))) ;
create policy documentos_clientes_select_documento_contratual on storage.objects as permissive for SELECT to authenticated using (((bucket_id = 'documentos-clientes'::text) AND pode_ver_documentos_contratuais(
CASE
    WHEN (split_part(name, '/'::text, 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN (split_part(name, '/'::text, 1))::uuid
    ELSE NULL::uuid
END))) ;

alter default privileges for role postgres in schema public grant execute on functions to authenticated;
alter default privileges for role postgres in schema public grant all on tables to authenticated;

-- Jobs agendados: inatividade, lembrete de documento, envio de DAS e da guia de parcelamento.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

-- Alertas ao setor, lidos pelo painel do Funcionário. Um alerta aberto por Cliente e tipo: o job
-- roda quatro vezes por mês e renova o mesmo aviso até a condição acabar ou alguém resolvê-lo.
-- 'entrega_parcial': a guia chegou por um canal só. Não é recorrente (o DAS já saiu de "pronto"),
-- então o job não a renova nem a resolve: fica aberta até alguém reenviar pelo outro canal.
CREATE TYPE public.tipo_alerta_setor AS ENUM (
    'das_pendente',
    'falha_envio',
    'contato_ausente',
    'entrega_parcial'
);

CREATE TABLE public.alertas_setor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setor public.setor_slug NOT NULL,
    tipo public.tipo_alerta_setor NOT NULL,
    cliente_id uuid NOT NULL,
    mensagem text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    resolvido_em timestamp with time zone,
    origem text DEFAULT 'lembretes'::text NOT NULL,
    CONSTRAINT alertas_setor_origem_check CHECK ((origem = ANY (ARRAY['lembretes'::text, 'parcelamento'::text])))
);

-- Reserva do envio automático: a intenção de entregar a guia, separada do estado final do cadastro
-- (R87-01). O DAS/Parcelamento só vira `enviado` ao CONCLUIR, depois de a entrega ser aceita; queda
-- no meio deixa o cadastro como estava e a reserva expira (retomada na rodada seguinte). Uma linha
-- por Cliente e tipo: a tentativa vigente. `token` prova a posse: concluir/liberar com token antigo
-- não tem efeito.
CREATE TABLE public.envios_automaticos (
    cliente_id uuid NOT NULL,
    tipo text NOT NULL,
    token uuid NOT NULL,
    reservado_em timestamp with time zone DEFAULT now() NOT NULL,
    concluido_em timestamp with time zone,
    CONSTRAINT envios_automaticos_tipo_check CHECK ((tipo = ANY (ARRAY['das'::text, 'parcelamento'::text])))
);

ALTER TABLE ONLY public.alertas_setor
    ADD CONSTRAINT alertas_setor_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.envios_automaticos
    ADD CONSTRAINT envios_automaticos_pkey PRIMARY KEY (cliente_id, tipo);

ALTER TABLE ONLY public.alertas_setor
    ADD CONSTRAINT alertas_setor_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.envios_automaticos
    ADD CONSTRAINT envios_automaticos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX alertas_setor_um_aberto_por_cliente_tipo_e_origem ON public.alertas_setor USING btree (cliente_id, tipo, origem) WHERE (resolvido_em IS NULL);

-- A desativação do dono limpa o aviso: junto, a entrega.
CREATE FUNCTION public.atendimento_em_aviso_nao_muda_de_dono() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if old.aviso_inatividade_em is not null
     and (new.funcionario_id is distinct from old.funcionario_id or new.setor <> old.setor) then
    if coalesce(current_setting('rigoni.devolucao_por_desativacao', true), '') = 'on' then
      new.aviso_inatividade_em := null;
      new.aviso_inatividade_de := null;
      new.aviso_entregue_em := null;
      return new;
    end if;
    raise exception 'Atendimento em aviso de inatividade nao pode ser transferido.';
  end if;
  return new;
end;
$$;

-- Inatividade: só a Mensagem entregue conta como a última do Funcionário.
CREATE FUNCTION public.atendimentos_para_inatividade() RETURNS TABLE(id uuid, setor public.setor_slug, funcionario_id uuid, telefone text, chave_telefone text, ultima_do_contato timestamp with time zone, ultima_do_funcionario timestamp with time zone, aviso_inatividade_em timestamp with time zone, aviso_inatividade_de public.autor_mensagem, aviso_entregue_em timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    a.id, a.setor, a.funcionario_id, a.telefone, a.chave_telefone,
    max(m.criado_em) filter (where m.autor = 'contato'),
    max(m.criado_em) filter (where m.autor = 'funcionario' and m.entrega = 'entregue'),
    a.aviso_inatividade_em, a.aviso_inatividade_de, a.aviso_entregue_em
  from public.atendimentos a
  left join public.mensagens m on m.atendimento_id = a.id
  where a.status = 'em_andamento' and a.funcionario_id is not null
  group by a.id
  order by a.id;
$$;

-- Auditoria da URA: o gatilho do cadastro não audita sem sessão de usuário, então a conclusão do
-- envio grava o evento aqui, com a URA como ator.
CREATE FUNCTION public.auditar_das_da_ura(p_cliente_id uuid, p_acao text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'simples_nacional',
         p_acao, cnpj, 'sucesso', now()
  from public.clientes where id = p_cliente_id;
$$;

-- Clientes com Cadastro operacional do Simples Nacional, o contato padrão e a última Mensagem do
-- contato, que decide a janela de 24h. Base interna, sem teto de linhas: as RPCs de leitura abaixo
-- paginam por cursor (cliente_id), porque o PostgREST corta a resposta em `max_rows`.
-- `contato_telefone` é o telefone de ENVIO (DDI 55 + DDD + número). A janela é consultada pela
-- chave NACIONAL (DDD + número), a mesma que o recebimento grava em `atendimentos.chave_telefone`
-- (`soDigitosNacionais`); as chaves históricas não são reescritas.
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

-- Leitura do job de lembrete: uma página por chamada, em ordem de cliente_id. `p_apos` é o último
-- cliente_id da página anterior.
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

-- Clientes com Parcelamento pendente (e tem parcelamento positivo), com o contato padrão e a janela
-- de 24h: a mesma base do job de lembrete, filtrada, em páginas por cursor (cliente_id). O filtro
-- entra antes do limite: a página é de pendentes, não dos primeiros clientes lidos.
CREATE FUNCTION public.clientes_para_parcelamento(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, email text, forma_envio public.forma_envio, contato_nome text, contato_telefone text, ultima_mensagem_do_contato_em timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.cliente_id, b.empresa, b.email, b.forma_envio, b.contato_nome, b.contato_telefone,
         b.ultima_mensagem_do_contato_em
    from public.clientes_para_envio_base() b
    join public.cliente_cadastro_operacional_sn o on o.cliente_id = b.cliente_id
   where o.tem_parcelamento and o.parcelamento_status = 'pendente'
     and (p_apos is null or b.cliente_id > p_apos)
   order by b.cliente_id
   limit p_limite;
$$;

-- A entrega foi aceita: DAS pronto → enviado com a data, auditado com a URA como ator. Só com a
-- posse da reserva (token). `true` se o cadastro foi atualizado; `false` sem a posse ou se o
-- Funcionário já havia mexido no DAS (a reserva é concluída do mesmo jeito: não há o que repetir).
CREATE FUNCTION public.concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date) RETURNS boolean
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
     set das_status = 'enviado', data_envio_das = p_data, atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'pronto';
  if not found then
    return false;
  end if;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-das-automatico');
  return true;
end;
$$;

-- A entrega foi aceita: Parcelamento pendente → enviado, auditado com a URA como ator, só com a
-- posse da reserva (`reservar_envio_automatico`, #52). Mesma regra do DAS: `false` sem a posse ou
-- se o Funcionário já havia mexido.
-- Nota: `auditar_das_da_ura` ficou com o nome do #52 mas audita qualquer ação automática da URA no
-- Cadastro operacional (`p_acao` diz qual); renomeá-la pede migration própria.
CREATE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
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

  update public.cliente_cadastro_operacional_sn
     set parcelamento_status = 'enviado', atualizado_em = now()
   where cliente_id = p_cliente_id and tem_parcelamento and parcelamento_status = 'pendente';
  if not found then
    return false;
  end if;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return true;
end;
$$;

-- O aviso ao cliente saiu: confirma a entrega. false se o aviso já não existe (cancelado).
CREATE FUNCTION public.confirmar_aviso_entregue(p_atendimento_id uuid) RETURNS boolean
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with confirmado as (
    update public.atendimentos
    set aviso_entregue_em = clock_timestamp()
    where id = p_atendimento_id and status = 'em_andamento'
      and aviso_inatividade_em is not null and aviso_entregue_em is null
    returning 1
  )
  select exists (select 1 from confirmado);
$$;

CREATE FUNCTION public.confirmar_encerramento_entregue(p_atendimento_id uuid, p_reivindicacao uuid) RETURNS boolean
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with confirmado as (
    update public.atendimentos
    set encerramento_pendente = false,
        encerramento_reivindicado_em = null,
        encerramento_reivindicacao = null
    where id = p_atendimento_id and encerramento_pendente
      and encerramento_reivindicacao = p_reivindicacao
    returning 1
  )
  select exists (select 1 from confirmado);
$$;

-- Encerra só sem ação de quem estava inativo depois do aviso: Mensagem entregue, ou envio pendente
-- recente (não fecha por cima de uma resposta que está saindo).
CREATE FUNCTION public.encerrar_atendimento_por_inatividade(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug, p_texto_final text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_resultado jsonb;
  v_reivindicacao uuid := gen_random_uuid();
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  perform 1 from public.atendimentos a
  where a.id = p_atendimento_id and a.status = 'em_andamento'
    and a.aviso_inatividade_em is not null and a.aviso_entregue_em is not null
  for update;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;
  if exists (
    select 1 from public.atendimentos a
    join public.mensagens m on m.atendimento_id = a.id
    where a.id = p_atendimento_id and m.autor = a.aviso_inatividade_de
      and m.criado_em > a.aviso_inatividade_em
      and (m.entrega = 'entregue'
           or (m.entrega = 'pendente' and m.criado_em > clock_timestamp() - interval '5 minutes'))
  ) then
    return jsonb_build_object('status', 'inexistente');
  end if;

  v_resultado := public.encerrar_atendimento(
    p_atendimento_id, p_funcionario_id, p_ator, p_ator_setor
  );
  if v_resultado ->> 'status' = 'encerrado' then
    insert into public.mensagens (atendimento_id, autor, texto)
    values (p_atendimento_id, 'ura', p_texto_final);
    update public.atendimentos
    set encerramento_pendente = true,
        encerramento_reivindicado_em = clock_timestamp(),
        encerramento_reivindicacao = v_reivindicacao,
        encerramento_tentativa_em = clock_timestamp(),
        encerramento_tentativas = 1
    where id = p_atendimento_id;
    v_resultado := v_resultado || jsonb_build_object('reivindicacao', v_reivindicacao);
  end if;
  return v_resultado;
end;
$$;

-- O envio falhou: devolve a reivindicação para a próxima rodada, sem esperar o lease.
CREATE FUNCTION public.liberar_encerramento_pendente(p_atendimento_id uuid, p_reivindicacao uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.atendimentos
  set encerramento_reivindicado_em = null, encerramento_reivindicacao = null
  where id = p_atendimento_id and encerramento_pendente
    and encerramento_reivindicacao = p_reivindicacao;
$$;

-- A entrega falhou (resposta definida, sem aceite): libera a reserva para a próxima rodada. Token
-- antigo não libera a reserva de outra tentativa.
CREATE FUNCTION public.liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  delete from public.envios_automaticos
   where cliente_id = p_cliente_id and tipo = p_tipo and token = p_token and concluido_em is null;
$$;

-- Reserva o aviso: uma Mensagem posterior à leitura do job (entregue, ou pendente recente: o envio
-- está em andamento e a decisão é de uma leitura velha) a adia para a próxima rodada.
CREATE FUNCTION public.marcar_aviso_inatividade(p_atendimento_id uuid, p_de public.autor_mensagem, p_visto_ate timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento' and aviso_inatividade_em is null
  for update;
  if not found then
    return false;
  end if;
  -- O job lê o instante em milissegundos (Date); a coluna guarda microssegundos.
  if exists (
    select 1 from public.mensagens m
    where m.atendimento_id = p_atendimento_id
      and date_trunc('milliseconds', m.criado_em) > p_visto_ate
      and (m.entrega = 'entregue'
           or (m.entrega = 'pendente' and m.criado_em > clock_timestamp() - interval '5 minutes'))
  ) then
    return false;
  end if;
  update public.atendimentos
  set aviso_inatividade_em = clock_timestamp(),
      aviso_inatividade_de = p_de,
      aviso_entregue_em = case when p_de = 'funcionario' then clock_timestamp() else null end
  where id = p_atendimento_id;
  return true;
end;
$$;

-- Abre o alerta ou, se já há um aberto do mesmo Cliente e tipo, renova mensagem e data: o setor
-- vê o problema mais recente, não o da primeira vez.
CREATE FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text DEFAULT 'lembretes'::text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem, origem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem, p_origem)
  on conflict (cliente_id, tipo, origem) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

-- #73 (revalidação 4 da PR #83): o backoff da reivindicação da mensagem final multiplicava a base
-- por 2^(tentativas - 1) antes de aplicar o teto. A partir de 39 tentativas (base de 1 minuto) o
-- produto estoura o intervalo ("interval out of range") dentro do filtro, e um único registro com
-- muitas falhas abortava a RPC inteira e a reentrega dos demais.
-- Agora o expoente é limitado ao que já alcança o teto, antes da multiplicação: o produto nunca
-- passa de 2 × teto, para qualquer base e teto. Mesma assinatura, rodízio, lease, token e lotes.
CREATE FUNCTION public.reivindicar_encerramentos_pendentes(p_limite integer, p_lease interval DEFAULT '00:10:00'::interval, p_backoff_base interval DEFAULT '00:01:00'::interval, p_backoff_teto interval DEFAULT '06:00:00'::interval) RETURNS TABLE(id uuid, telefone text, texto text, reivindicacao uuid)
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with alvo as (
    select a.id from public.atendimentos a
    where a.status = 'encerrado' and a.encerramento_pendente
      and (a.encerramento_reivindicado_em is null
           or a.encerramento_reivindicado_em < clock_timestamp() - p_lease)
      and (a.encerramento_tentativa_em is null
           or a.encerramento_tentativa_em < clock_timestamp() - least(
                p_backoff_base * power(2, least(
                  greatest(a.encerramento_tentativas - 1, 0),
                  -- Expoente que já alcança o teto: acima dele o produto só cresceria até estourar
                  -- o intervalo (39 tentativas com a base de 1 min), e o `least` chegaria tarde.
                  greatest(ceil(log(2,
                    greatest(extract(epoch from p_backoff_teto), 1)
                    / greatest(extract(epoch from p_backoff_base), 0.000001)))::int, 0))),
                p_backoff_teto))
    order by a.encerramento_tentativa_em nulls first, a.id
    limit p_limite
    for update skip locked
  ),
  reivindicado as (
    update public.atendimentos a
    set encerramento_reivindicado_em = clock_timestamp(),
        encerramento_reivindicacao = gen_random_uuid(),
        encerramento_tentativa_em = clock_timestamp(),
        encerramento_tentativas = a.encerramento_tentativas + 1
    from alvo
    where a.id = alvo.id
    returning a.id, a.telefone, a.encerramento_reivindicacao
  )
  select r.id, r.telefone, (
    select m.texto from public.mensagens m
    where m.atendimento_id = r.id and m.autor = 'ura'
    order by m.criado_em desc, m.id desc
    limit 1
  ), r.encerramento_reivindicacao
  from reivindicado r
  order by r.id;
$$;

-- Reserva a entrega: devolve o token da tentativa, ou null se o cadastro já não está elegível
-- (pronto/pendente) ou outra tentativa vigente (não expirada) já a reservou. O cadastro é travado
-- antes: a conclusão de outra tentativa termina antes de esta avaliar a elegibilidade.
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
           else o.tem_parcelamento and o.parcelamento_status = 'pendente'
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

-- Ao fim da rodada: o que o job não renovou desde `p_desde` deixou de valer (o Cliente regularizou).
-- Só vale para os Clientes que a rodada avaliou (`p_cliente_ids`): a ausência de um alerta no que
-- o job leu não prova regularização de quem ele não leu. A entrega parcial fica de fora: ela só se
-- resolve com uma ação humana.
CREATE FUNCTION public.resolver_alertas_setor_nao_renovados(p_desde timestamp with time zone, p_origem text, p_cliente_ids uuid[]) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.alertas_setor
     set resolvido_em = now()
   where resolvido_em is null and criado_em < p_desde and tipo <> 'entrega_parcial'
     and origem = p_origem and cliente_id = any (p_cliente_ids);
$$;

CREATE TRIGGER atendimento_em_aviso_nao_muda_de_dono BEFORE UPDATE OF funcionario_id, setor ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_em_aviso_nao_muda_de_dono();

ALTER TABLE public.alertas_setor ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.envios_automaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY alertas_setor_select ON public.alertas_setor FOR SELECT USING ((public.acesso_liberado() AND ((public.meu_papel() = 'admin'::public.papel) OR (setor = public.meu_setor()))));

-- Grants de tabela (Supabase não concede mais por default): `authenticated` só recebe o que as
-- policies deste arquivo usam (o RLS filtra as linhas); `service_role` ignora RLS e fica com tudo.
grant select on table public.alertas_setor to authenticated;
grant all on table public.alertas_setor to service_role;
grant all on table public.envios_automaticos to service_role;

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on function public.atendimentos_para_inatividade() from public, anon, authenticated;
grant execute on function public.atendimentos_para_inatividade() to service_role;

revoke all on function public.auditar_das_da_ura(uuid, text) from public, anon, authenticated;
grant execute on function public.auditar_das_da_ura(uuid, text) to service_role;

revoke all on function public.clientes_para_envio_base() from public, anon, authenticated;
grant execute on function public.clientes_para_envio_base() to service_role;

revoke all on function public.clientes_para_lembrete(uuid, integer) from public, anon, authenticated;
grant execute on function public.clientes_para_lembrete(uuid, integer) to service_role;

revoke all on function public.clientes_para_parcelamento(uuid, integer) from public, anon, authenticated;
grant execute on function public.clientes_para_parcelamento(uuid, integer) to service_role;

revoke all on function public.concluir_envio_automatico_das(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.concluir_envio_automatico_das(uuid, uuid, date) to service_role;

revoke all on function public.concluir_envio_automatico_parcelamento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.concluir_envio_automatico_parcelamento(uuid, uuid) to service_role;

revoke all on function public.confirmar_aviso_entregue(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_aviso_entregue(uuid) to service_role;

revoke all on function public.confirmar_encerramento_entregue(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirmar_encerramento_entregue(uuid, uuid) to service_role;

revoke all on function public.encerrar_atendimento_por_inatividade(uuid, uuid, uuid, public.setor_slug, text) from public, anon, authenticated;
grant execute on function public.encerrar_atendimento_por_inatividade(uuid, uuid, uuid, public.setor_slug, text) to service_role;

revoke all on function public.liberar_encerramento_pendente(uuid, uuid) from public, anon, authenticated;
grant execute on function public.liberar_encerramento_pendente(uuid, uuid) to service_role;

revoke all on function public.liberar_envio_automatico(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.liberar_envio_automatico(uuid, text, uuid) to service_role;

revoke all on function public.marcar_aviso_inatividade(uuid, public.autor_mensagem, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.marcar_aviso_inatividade(uuid, public.autor_mensagem, timestamp with time zone) to service_role;

revoke all on function public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text, text) from public, anon, authenticated;
grant execute on function public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text, text) to service_role;

revoke all on function public.reivindicar_encerramentos_pendentes(integer, interval, interval, interval) from public, anon, authenticated;
grant execute on function public.reivindicar_encerramentos_pendentes(integer, interval, interval, interval) to service_role;

revoke all on function public.reservar_envio_automatico(uuid, text, interval) from public, anon, authenticated;
grant execute on function public.reservar_envio_automatico(uuid, text, interval) to service_role;

revoke all on function public.resolver_alertas_setor_nao_renovados(timestamp with time zone, text, uuid[]) from public, anon, authenticated;
grant execute on function public.resolver_alertas_setor_nao_renovados(timestamp with time zone, text, uuid[]) to service_role;


-- Guias do DAS publicadas para o provedor de mensagem/e-mail buscar por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias-fiscais', 'guias-fiscais', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

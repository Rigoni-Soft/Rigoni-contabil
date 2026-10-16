-- Atendimento: modelo, mensagens, transferência, Fila e feriados.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

CREATE TYPE public.autor_mensagem AS ENUM (
    'contato',
    'ura',
    'funcionario'
);

-- Revalidação 1 da PR #85 (R85-01.A e R85-01.B).
--
-- A) A Mensagem do Funcionário revalida a autoridade do ator no perfil REAL, sob lock, em vez de
--    confiar em papel/setor passados pelo caller: um Líder desativado ou rebaixado entre o início da
--    requisição e a gravação deixa de poder gravar. Ordem de locks: perfil (`for share`) e depois a
--    linha do Atendimento, a mesma de desativar_usuario (perfil → atendimentos); alterar_papel só
--    trava o perfil, então não há inversão.
-- B) A intenção de envio deixa de ser uma Mensagem comum: nasce `pendente` e só vira `entregue` com o
--    aceite do adapter (ou `falha`). A linha nunca é apagada pela compensação (evidência de uma
--    entrega incerta, e o anexo continua referenciado). Só `entregue` conta como ação do
--    Funcionário na inatividade; `pendente` recente adia o aviso e o encerramento em vez de
--    cancelá-los ou deixá-los passar por cima do envio em andamento.
CREATE TYPE public.entrega_mensagem AS ENUM (
    'pendente',
    'entregue',
    'falha'
);

-- #44: Atendimento e Mensagem persistidos + atribuição direta por Balanceamento mensal.
-- `funcionario_id` null = ainda sem Funcionário humano (a URA sozinha não conta no balanceamento).
CREATE TYPE public.status_atendimento AS ENUM (
    'em_andamento',
    'encerrado'
);

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
    aviso_inatividade_em timestamp with time zone,
    aviso_inatividade_de public.autor_mensagem,
    aviso_entregue_em timestamp with time zone,
    encerramento_pendente boolean DEFAULT false NOT NULL,
    encerramento_reivindicado_em timestamp with time zone,
    encerramento_reivindicacao uuid,
    encerramento_tentativa_em timestamp with time zone,
    encerramento_tentativas integer DEFAULT 0 NOT NULL,
    CONSTRAINT atendimentos_aviso_inatividade_de_check CHECK ((aviso_inatividade_de = ANY (ARRAY['contato'::public.autor_mensagem, 'funcionario'::public.autor_mensagem]))),
    CONSTRAINT atendimentos_check CHECK (((funcionario_id IS NULL) = (assumido_em IS NULL))),
    CONSTRAINT atendimentos_check1 CHECK (((aviso_inatividade_em IS NULL) = (aviso_inatividade_de IS NULL))),
    CONSTRAINT atendimentos_check2 CHECK (((aviso_entregue_em IS NULL) OR (aviso_inatividade_em IS NOT NULL))),
    CONSTRAINT atendimentos_cnpj_informado_check CHECK ((cnpj_informado ~ '^[0-9A-Z]{14}$'::text)),
    CONSTRAINT atendimentos_resumo_ura_check CHECK (((length(btrim(resumo_ura)) >= 1) AND (length(btrim(resumo_ura)) <= 1000)))
);

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

-- #45: Transferência de Atendimento em andamento para outro Setor.
-- Uma linha por Transferência guarda a origem e o resumo do assunto que o Funcionário de destino
-- recebe; o Atendimento em si só muda de Setor/Funcionário.
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

-- Devolutiva técnica da PR #77 (B2, B3, I1): elegibilidade do atendente, ordem da Fila e crédito mensal.
--
-- B2: só perfil ATIVO e do Setor de destino recebe Atendimento, conferido dentro da operação (com
-- lock da linha do perfil: uma desativação concorrente espera ou é vista).
-- B3: quem tem alguém mais antigo e elegível na Fila (a do Setor ou a dele) assume o mais antigo
-- antes de o recém-chegado ser admitido; o recém-chegado espera na Fila.
-- I1: o Balanceamento mensal conta EVENTOS de assunção (tabela imutável), não o dono atual do
-- Atendimento: quem atendeu e transferiu continua com o crédito, e o destino ganha o dele ao assumir.
CREATE TABLE public.assuncoes_atendimento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atendimento_id uuid NOT NULL,
    funcionario_id uuid NOT NULL,
    assumido_em timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

-- #72: feriados estaduais e municipais cadastrados pelo Admin (os nacionais ficam no código).
-- Fora do expediente a URA só avisa o horário; esta tabela decide quais dias úteis contam como
-- feriado. A webhook lê com service_role; a tela do Admin escreve com a sessão dele.
CREATE TABLE public.feriados (
    data date NOT NULL,
    descricao text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feriados_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 200)))
);

-- Devolutiva da PR #85, R85-03: finalizar de novo um upload já consumido por uma Mensagem podia
-- apagar o arquivo do histórico (a compensação de uma segunda tentativa que falha remove o caminho
-- recebido). Aqui o objeto subido em partes tem posse e consumo idempotentes: quem reserva o caminho
-- antes de validar é o dono daquela tentativa; a reserva de quem concluiu fica (consumo), e a de
-- quem falhou é liberada junto da remoção do objeto.
CREATE TABLE public.anexos_em_envio (
    caminho text NOT NULL,
    atendimento_id uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.anexos_em_envio
    ADD CONSTRAINT anexos_em_envio_pkey PRIMARY KEY (caminho);

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feriados
    ADD CONSTRAINT feriados_pkey PRIMARY KEY (data);

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anexos_em_envio
    ADD CONSTRAINT anexos_em_envio_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.assuncoes_atendimento
    ADD CONSTRAINT assuncoes_atendimento_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_fila_funcionario_id_fkey FOREIGN KEY (fila_funcionario_id) REFERENCES public.perfis(id);

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.perfis(id);

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_funcionario_destino_id_fkey FOREIGN KEY (funcionario_destino_id) REFERENCES public.perfis(id);

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_funcionario_origem_id_fkey FOREIGN KEY (funcionario_origem_id) REFERENCES public.perfis(id);

CREATE INDEX assuncoes_atendimento_funcionario_mes ON public.assuncoes_atendimento USING btree (funcionario_id, assumido_em);

-- Único: um número só tem um Atendimento em andamento. Na corrida entre dois webhooks o segundo
-- insert falha (erro nessa chamada); a reentrega da Meta já encontra o Atendimento e anexa.
CREATE UNIQUE INDEX atendimentos_em_andamento_telefone ON public.atendimentos USING btree (chave_telefone) WHERE (status = 'em_andamento'::public.status_atendimento);

CREATE INDEX atendimentos_encerramento_pendente ON public.atendimentos USING btree (id) WHERE encerramento_pendente;

CREATE INDEX atendimentos_funcionario_mes ON public.atendimentos USING btree (funcionario_id, assumido_em);

CREATE INDEX mensagens_atendimento ON public.mensagens USING btree (atendimento_id, criado_em);

CREATE UNIQUE INDEX mensagens_atendimento_id_externo ON public.mensagens USING btree (atendimento_id, id_externo) WHERE (id_externo IS NOT NULL);

CREATE INDEX transferencias_atendimento ON public.transferencias USING btree (atendimento_id, criado_em);

-- Elegível a receber Atendimento do Setor: do Setor e não desativado. `for share` trava a linha do
-- perfil até o fim da transação: desativar essa conta no meio espera, e o que já foi desativado
-- é recusado aqui.
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

-- Funcionário livre assume o Atendimento mais antigo da Fila do Setor ou da sua própria Fila,
-- ignorando o Balanceamento. Só um atendente elegível assume. QUEM CHAMA já segura o lock do Setor.
CREATE FUNCTION public.assumir_proximo_da_fila(p_funcionario_id uuid, p_setor public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_telefone text;
  v_chave text;
begin
  if not public.atendente_elegivel(p_funcionario_id, p_setor) then
    return null;
  end if;
  if exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_id and status = 'em_andamento'
  ) then
    return null;
  end if;

  select a.id, a.telefone, a.chave_telefone into v_id, v_telefone, v_chave
  from public.atendimentos a
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
    and (a.fila_funcionario_id is null or a.fila_funcionario_id = p_funcionario_id)
  order by a.fila_desde, a.id
  limit 1
  for update;
  if v_id is null then
    return null;
  end if;

  update public.atendimentos
  set funcionario_id = p_funcionario_id, fila_funcionario_id = null,
      fila_desde = null, assumido_em = now()
  where id = v_id;
  insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
  values (v_id, p_funcionario_id);

  return jsonb_build_object(
    'id', v_id, 'telefone', v_telefone, 'chave', v_chave,
    'funcionario_nome', (select nome from public.perfis where id = p_funcionario_id)
  );
end;
$$;

-- Funcionários ATIVOS do Setor com o crédito do mês (fuso de Brasília) e se estão livres.
CREATE FUNCTION public.funcionarios_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, atendimentos_no_mes bigint, livre boolean)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    p.id,
    (
      select count(*) from public.assuncoes_atendimento s
      where s.funcionario_id = p.id
        and s.assumido_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
                             at time zone 'America/Sao_Paulo'
    ),
    not exists (
      select 1 from public.atendimentos a
      where a.funcionario_id = p.id and a.status = 'em_andamento'
    )
  from public.perfis p
  where p.setor = p_setor and p.desativado_em is null
  order by p.nome, p.id;
$$;

-- Funcionário livre do Setor com menos Atendimentos no mês (empate: ordem de `funcionarios_do_setor`),
-- ou null. Serve a quem entra na Fila de Setor já sob o lock dele: se um Funcionário foi liberado
-- depois que o chamador listou e a Fila estava vazia, ninguém o promoveria; então o recém-chegado
-- o assume em vez de esperar parado.
CREATE FUNCTION public.funcionario_livre_do_setor(p_setor public.setor_slug) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select id from (
    select f.*, row_number() over () as ordem from public.funcionarios_do_setor(p_setor) f
  ) t
  where livre
  order by atendimentos_no_mes, ordem
  limit 1;
$$;

-- Mesma assinatura: só o insert das Mensagens passa a gravar `idExterno` (chave do jsonb).
CREATE FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_funcionario_id uuid, p_mensagens jsonb, p_atribuir_livre boolean DEFAULT false, p_resumo text DEFAULT NULL::text, p_cnpj_informado text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_funcionario uuid := p_funcionario_id;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  -- Mantém o que a PR #77 garante (atendente elegível, a Fila antiga na frente, crédito por
  -- assunção): esta função substitui a de `20261007090000_atendimento_origem_ura.sql`.
  if v_funcionario is not null then
    if not public.atendente_elegivel(v_funcionario, p_setor) then
      return null;
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_funcionario and status = 'em_andamento'
    ) then
      return null;
    end if;
    v_promovido := public.assumir_proximo_da_fila(v_funcionario, p_setor);
    if v_promovido is not null then
      v_funcionario := null;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor and status = 'em_andamento' and funcionario_id is null
  ) then
    v_funcionario := public.funcionario_livre_do_setor(p_setor);
    -- Desativado entre a escolha e agora: revalida com lock (PR #77, 2ª devolutiva); inelegível
    -- não recebe, o Atendimento espera na Fila.
    if v_funcionario is not null
       and not public.atendente_elegivel(v_funcionario, p_setor) then
      v_funcionario := null;
    end if;
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde,
    resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave,
    coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado)),
    p_setor, v_funcionario,
    case when v_funcionario is null then null else clock_timestamp() end,
    case when v_funcionario is null then clock_timestamp() else null end,
    p_resumo, p_cnpj_informado
  )
  returning id into v_id;
  if v_funcionario is not null then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (v_id, v_funcionario);
  end if;

  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto', m ->> 'idExterno'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object(
    'id', v_id, 'funcionario_id', v_funcionario, 'promovido', v_promovido
  );
end;
$$;

-- `for update`: a Mensagem entra sob lock da linha do Atendimento, serializada com o encerramento
-- por inatividade (20261013080000_inatividade_reserva_atomica.sql, devolutiva da PR #83).
-- Mesma assinatura: reentrega do mesmo `p_id_externo` não insere de novo e continua `true`
-- (a Mensagem já está no Atendimento; a Meta pode confirmar com 200).
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

-- Mesma ideia de `auditar_cliente_criado`: o evento nasce na transação da escrita, com ator e
-- setor da sessão do banco. Sem sessão (seed, migration, service_role) não há ator a registrar.
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

-- Ordem de locks igual à de abrir/transferir (advisory do Setor, depois a linha do perfil): o
-- contrário deixaria a desativação e uma abertura concorrente se esperarem em ciclo.
CREATE FUNCTION public.desativar_usuario(alvo_id uuid, ator_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
  v_setor public.setor_slug;
  v_livre uuid;
  v_assumido jsonb;
begin
  select setor into v_setor from public.perfis where id = alvo_id;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_alvo from public.perfis where id = alvo_id for update;
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

  -- Os Atendimentos do desativado voltam à Fila do Setor. A marca vale só nesta transação: quem
  -- protege o dono do Atendimento (ex.: aviso de inatividade, #73) distingue a devolução da
  -- Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        fila_funcionario_id = null,
        assumido_em = null,
        -- FIFO é a ordem de entrada na Fila, não a de abertura: quem estava sendo atendido entra
        -- agora (atrás de quem já esperava); quem esperava na fila pessoal do desativado mantém a
        -- espera. Os `a.*` do SET são os valores de antes da atualização.
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

  -- Funcionário ativo livre no Setor assume o mais antigo da Fila (o próprio desativado já não conta).
  loop
    v_livre := public.funcionario_livre_do_setor(v_alvo.setor);
    exit when v_livre is null;
    v_assumido := public.assumir_proximo_da_fila(v_livre, v_alvo.setor);
    exit when v_assumido is null;
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), v_ator.id, v_alvo.setor, 'atendimento.reatribuir',
            v_assumido ->> 'id', 'sucesso', now());
  end loop;
end;
$$;

-- Encerra o Atendimento do Funcionário (null = um da Fila), grava a auditoria de sucesso e, se havia
-- Funcionário, libera ele pro próximo da Fila: tudo numa transação, sob o lock do Setor (mesmo
-- contrato de ator de `transferir_atendimento`). Devolve jsonb com `status`:
--  - 'inexistente': não está em andamento com esse dono (ou o Setor mudou no meio);
--  - 'encerrado': com `proximo`, o Atendimento que o Funcionário assumiu (ou null).
CREATE FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_proximo jsonb;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  update public.atendimentos set status = 'encerrado'
  where id = p_atendimento_id and status = 'em_andamento' and setor = v_setor
    and funcionario_id is not distinct from p_funcionario_id;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.encerrar',
    p_atendimento_id::text, 'sucesso'
  );

  if p_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_funcionario_id, v_setor);
  end if;
  return jsonb_build_object('status', 'encerrado', 'proximo', v_proximo);
end;
$$;

-- A Fila do Setor (a do Setor e as de usuários), do mais antigo ao mais novo, com a posição em
-- cada Fila, o que já se sabe do Contato e o resumo da última Transferência.
CREATE FUNCTION public.fila_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, posicao integer, fila_funcionario_id uuid, fila_desde timestamp with time zone, telefone text, contato_nome text, empresa text, cnpj text, resumo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    a.id,
    (row_number() over (partition by a.fila_funcionario_id order by a.fila_desde, a.id))::integer,
    a.fila_funcionario_id, a.fila_desde, a.telefone,
    (select ct.nome from public.cliente_contatos ct
      where ct.cliente_id = a.cliente_id
        and regexp_replace(ct.telefone, '\D', '', 'g') = a.chave_telefone
      order by ct.padrao desc, ct.criado_em limit 1),
    c.empresa, c.cnpj,
    (select t.resumo from public.transferencias t
      where t.atendimento_id = a.id order by t.criado_em desc limit 1)
  from public.atendimentos a
  left join public.clientes c on c.id = a.cliente_id
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
  order by a.fila_desde, a.id;
$$;

-- Posição (1 = próximo) do Atendimento na Fila em que está: a do Setor ou a do usuário (a mesma
-- numeração de `fila_do_setor`). null se não está em Fila. ponytail: a Fila de um usuário e a do
-- Setor concorrem pelo mesmo Funcionário ao liberar (`assumir_proximo_da_fila`); cada Fila conta
-- só os seus, então a posição é um mínimo.
CREATE FUNCTION public.posicao_na_fila(p_atendimento_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select count(*)::integer
  from public.atendimentos a
  join public.atendimentos b
    on b.setor = a.setor and b.status = 'em_andamento' and b.funcionario_id is null
   and b.fila_funcionario_id is not distinct from a.fila_funcionario_id
   and (b.fila_desde, b.id) <= (a.fila_desde, a.id)
  where a.id = p_atendimento_id and a.status = 'em_andamento' and a.funcionario_id is null;
$$;

-- Transfere. Destino inelegível (outro Setor ou desativado): "conflito", sem mudar nada. Destino
-- livre mas com alguém mais antigo na Fila dele (a do Setor de destino ou a pessoal): o mais antigo
-- assume (`promovido`) e o transferido espera na Fila (a pessoal do destino fixo, ou a do Setor).
CREATE FUNCTION public.transferir_atendimento(p_atendimento_id uuid, p_origem_funcionario_id uuid, p_setor_destino public.setor_slug, p_funcionario_destino_id uuid, p_resumo text, p_ator uuid, p_ator_setor public.setor_slug, p_enfileirar_se_ocupado boolean, p_setor_origem public.setor_slug, p_atribuir_livre boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atendimento public.atendimentos;
  v_contato_nome text;
  v_empresa text;
  v_cnpj text;
  v_na_fila boolean := false;
  v_destino uuid := p_funcionario_destino_id;
  v_proximo jsonb;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtext('atendimento:' || least(p_setor_destino::text, p_setor_origem::text)));
  if p_setor_origem <> p_setor_destino then
    perform pg_advisory_xact_lock(
      hashtext('atendimento:' || greatest(p_setor_destino::text, p_setor_origem::text)));
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found
     or v_atendimento.funcionario_id is distinct from p_origem_funcionario_id
     or v_atendimento.setor is distinct from p_setor_origem then
    return jsonb_build_object('status', 'inexistente');
  end if;

  if v_destino is not null then
    if not public.atendente_elegivel(v_destino, p_setor_destino) then
      return jsonb_build_object('status', 'conflito');
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_destino and status = 'em_andamento'
        and id <> p_atendimento_id
    ) then
      if not p_enfileirar_se_ocupado then
        return jsonb_build_object('status', 'conflito');
      end if;
      v_na_fila := true;
    else
      v_promovido := public.assumir_proximo_da_fila(v_destino, p_setor_destino);
      if v_promovido is not null then
        if p_enfileirar_se_ocupado then
          v_na_fila := true;
        else
          v_destino := null;
        end if;
      end if;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor_destino and status = 'em_andamento' and funcionario_id is null
  ) then
    v_destino := public.funcionario_livre_do_setor(p_setor_destino);
    -- Idem abrir: a escolha automática também é revalidada com lock até o fim da operação.
    if v_destino is not null
       and not public.atendente_elegivel(v_destino, p_setor_destino) then
      v_destino := null;
    end if;
  end if;

  -- Na fila de um usuário: sem dono ainda (funcionario_id e assumido_em nulos) e
  -- `fila_funcionario_id` aponta quem vai atender; fila do Setor = os dois nulos.
  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = case when v_na_fila then null else v_destino end,
      fila_funcionario_id = case when v_na_fila then v_destino else null end,
      assumido_em = case
        when v_na_fila or v_destino is null then null else clock_timestamp() end,
      fila_desde = case
        when v_na_fila or v_destino is null then clock_timestamp() else null end
  where id = p_atendimento_id;
  if v_destino is not null and not v_na_fila then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (p_atendimento_id, v_destino);
  end if;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, v_destino, btrim(p_resumo)
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

  if p_origem_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_origem_funcionario_id, p_setor_origem);
  end if;

  return jsonb_build_object(
    'status', 'transferido',
    'proximo_da_origem', v_proximo,
    'promovido', v_promovido,
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = v_destino),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;

CREATE TRIGGER feriados_auditar AFTER INSERT OR DELETE ON public.feriados FOR EACH ROW EXECUTE FUNCTION public.auditar_feriado();

ALTER TABLE public.anexos_em_envio ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assuncoes_atendimento ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY feriados_delete_admin ON public.feriados FOR DELETE USING ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

CREATE POLICY feriados_insert_admin ON public.feriados FOR INSERT WITH CHECK ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

CREATE POLICY feriados_select_admin ON public.feriados FOR SELECT USING ((public.acesso_liberado() AND (public.meu_papel() = 'admin'::public.papel)));

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on table public.atendimentos from anon, authenticated;
grant all on table public.atendimentos to service_role;

revoke all on table public.mensagens from anon, authenticated;
grant all on table public.mensagens to service_role;

revoke all on table public.transferencias from anon, authenticated;
grant all on table public.transferencias to service_role;

revoke all on table public.assuncoes_atendimento from anon, authenticated;
grant all on table public.assuncoes_atendimento to service_role;

revoke all on table public.anexos_em_envio from anon, authenticated;
grant all on table public.anexos_em_envio to service_role;

revoke all on function public.atendente_elegivel(uuid, public.setor_slug) from public, anon, authenticated;
grant execute on function public.atendente_elegivel(uuid, public.setor_slug) to service_role;

revoke all on function public.assumir_proximo_da_fila(uuid, public.setor_slug) from public, anon, authenticated;
grant execute on function public.assumir_proximo_da_fila(uuid, public.setor_slug) to service_role;

revoke all on function public.funcionarios_do_setor(public.setor_slug) from public, anon, authenticated;
grant execute on function public.funcionarios_do_setor(public.setor_slug) to service_role;

revoke all on function public.funcionario_livre_do_setor(public.setor_slug) from public, anon, authenticated;
grant execute on function public.funcionario_livre_do_setor(public.setor_slug) to service_role;

revoke all on function public.abrir_atendimento(text, text, uuid, public.setor_slug, uuid, jsonb, boolean, text, text) from public, anon, authenticated;
grant execute on function public.abrir_atendimento(text, text, uuid, public.setor_slug, uuid, jsonb, boolean, text, text) to service_role;

revoke all on function public.anexar_mensagem_atendimento(text, public.autor_mensagem, text, text) from public, anon, authenticated;
grant execute on function public.anexar_mensagem_atendimento(text, public.autor_mensagem, text, text) to service_role;

revoke all on function public.auditar_feriado() from public, anon, authenticated;
grant execute on function public.auditar_feriado() to service_role;

revoke all on function public.desativar_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.desativar_usuario(uuid, uuid) to service_role;

revoke all on function public.encerrar_atendimento(uuid, uuid, uuid, public.setor_slug) from public, anon, authenticated;
grant execute on function public.encerrar_atendimento(uuid, uuid, uuid, public.setor_slug) to service_role;

revoke all on function public.fila_do_setor(public.setor_slug) from public, anon, authenticated;
grant execute on function public.fila_do_setor(public.setor_slug) to service_role;

revoke all on function public.posicao_na_fila(uuid) from public, anon, authenticated;
grant execute on function public.posicao_na_fila(uuid) to service_role;

revoke all on function public.transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean, public.setor_slug, boolean) from public, anon, authenticated;
grant execute on function public.transferir_atendimento(uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean, public.setor_slug, boolean) to service_role;


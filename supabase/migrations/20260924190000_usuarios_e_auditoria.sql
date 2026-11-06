-- Usuários, setores, auditoria e controle de acesso.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

-- Modulo usuarios: papel, setor e perfil vinculado a auth.users, com RLS.
CREATE TYPE public.papel AS ENUM (
    'admin',
    'lider_setor',
    'funcionario'
);

-- Modulo auditoria (ticket #29): registro imutavel de acoes que mudam estado.
-- Devolutiva técnica PR #61, ajuste residual: falha da própria compensação
-- (rollback) precisa virar um resultado de auditoria distinto de "falha" comum,
-- pra ficar filtrável no feed e virar o caminho de reconciliação manual.
CREATE TYPE public.resultado_acao AS ENUM (
    'sucesso',
    'falha',
    'falha_compensacao'
);

-- Setores do organograma real, exceto Patriki (raiz, nao e setor) e Expedicao.
-- Presumido/Real renomeado para Tributario. Zeladoria (subtime de Financeiro)
-- nao vira setor proprio de login -- decisao definitiva, confirmada na revisao do #28.
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

-- ponytail: email duplicado de auth.users pra evitar chamada admin API no repositorio;
-- se o e-mail puder ser trocado depois, sincronizar via trigger quando isso virar requisito.
-- (acrescentado em 20260927090000):
-- Ticket #31: troca obrigatoria de senha no primeiro login.
-- senha_trocada_em nula = ainda esta na senha provisoria do #30.
-- senha_provisoria_expira_em: vencimento em 48h (decisao revisada no #19).
-- (acrescentado em 20261001090000):
-- Devolutiva tecnica PR #62 (retry): depois que updateUser() muda a senha no
-- Auth, uma falha na auditoria ou na finalizacao do perfil precisa ser
-- recuperavel SEM pedir nova troca de senha e SEM auditoria duplicada.
--
-- 1) senha_auth_alterada_em: prova de que updateUser() teve sucesso. Gravado
--    DEPOIS da troca no Auth (nunca antes, nunca por "tentativa iniciada"), via
--    registrar_auth_senha_alterada. Perfil em primeiro acesso + prova presente =
--    so falta perfil + auditoria, e o retry pula updateUser() por completo.
-- 2) finalizar_troca_senha: auditoria + senha_trocada_em na MESMA transacao e
--    idempotente (linha travada; se ja finalizada, nao faz nada) -- exatamente
--    1 evento de auditoria por troca, mesmo com N retries.
-- (acrescentado em 20261003091000):
-- #58: Admin desativa (soft delete) um Lider/Funcionario. O perfil continua
-- existindo (historico de auditoria preservado); o login e barrado no app
-- (Login/ObterSessao) e no Auth (ban, feito pelo caso de uso via service_role).
-- (acrescentado em 20261005100000):
-- Ponto D: "perfil desativado, ban pendente" fica rastreável. `banido_em` só é
-- preenchido depois que o Auth confirma o ban; desativado sem banido_em = pendência
-- que o Admin vê e reprocessa na tela de usuários.
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

CREATE TABLE public.registros_auditoria (
    id uuid NOT NULL,
    ator uuid NOT NULL,
    setor public.setor_slug NOT NULL,
    acao text NOT NULL,
    alvo text NOT NULL,
    resultado public.resultado_acao NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.registros_auditoria
    ADD CONSTRAINT registros_auditoria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- #57: Admin troca o papel de um usuario (Funcionario <-> Lider de setor).
-- Regra: cada Setor tem no maximo UM Lider ativo (nao desativado, #58). Garantida
-- no banco por indice unico parcial: fecha a corrida de duas promocoes simultaneas
-- que passariam na checagem do caso de uso.
CREATE UNIQUE INDEX perfis_um_lider_ativo_por_setor ON public.perfis USING btree (setor) WHERE ((papel = 'lider_setor'::public.papel) AND (desativado_em IS NULL));

-- Devolutiva técnica PR #69, ponto 2: `meu_papel()`/`meu_setor()` só devolvem
-- NULL depois que a senha provisória VENCE (ADR 0002); durante as 48h de
-- janela, uma conta que ainda não trocou a senha satisfaz qualquer policy de
-- papel via Data API. As policies de dados de negócio deste ticket exigem
-- primeiro acesso finalizado. Helper específico, sem mexer em meu_papel()
-- (que o #29/#30/#31 reusam): o SELECT do próprio perfil (`perfis_select_proprio`,
-- `id = auth.uid()`) não passa por aqui e segue liberado pro fluxo de troca.
CREATE FUNCTION public.acesso_liberado() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and senha_trocada_em is not null and desativado_em is null
  );
$$;

-- Ponto C: promover um Funcionário que ainda é Responsável é recusado, sem mutação
-- parcial: o Líder redistribui os Clientes antes. Nada é desvinculado em silêncio.
-- Mensagem estável (responsavel_com_clientes) que o gateway traduz.
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

-- Devolutiva técnica PR #75. Migration nova (as de origem já estão mergeadas e não
-- se reescrevem): conta desativada perde o acesso no banco, Responsável é
-- desfeito na desativação e na promoção, e o bloqueio no Auth vira rastreável.
-- Ponto A: o ban do Auth não revoga um JWT já emitido (vale até expirar). O estado
-- "desativado" passa a ser requisito de autorização no banco. Toda policy de papel,
-- setor ou acesso liberado já passa por estes três helpers (meu_papel/meu_setor
-- inclusive nas policies de storage.objects), então uma troca cobre todas. O SELECT
-- do próprio perfil (`perfis_select_proprio`, id = auth.uid()) não passa por aqui e
-- segue liberado: a conta lê só a si mesma.
CREATE FUNCTION public.meu_papel() RETURNS public.papel
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select papel from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

CREATE FUNCTION public.meu_setor() RETURNS public.setor_slug
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select setor from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

-- Devolutiva tecnica PR #60, bloqueador 01: sem policy de INSERT, a tabela fica
-- fechada pra qualquer escrita direta via Data API (mesmo com `ator = auth.uid()`,
-- um usuario autenticado ainda escolheria setor/acao/alvo/resultado/criado_em
-- livremente). A unica porta de escrita e a funcao abaixo (SECURITY DEFINER),
-- que ignora qualquer valor de ator/criado_em vindo do chamador e usa
-- auth.uid()/now() do proprio banco -- autenticidade garantida no servidor,
-- nao so por policy.
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

CREATE FUNCTION public.registrar_auth_senha_alterada(usuario_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.perfis
  set senha_auth_alterada_em = coalesce(senha_auth_alterada_em, now())
  where id = usuario_id and senha_trocada_em is null;
$$;

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.registros_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfis_insert_admin ON public.perfis FOR INSERT WITH CHECK ((public.meu_papel() = 'admin'::public.papel));

CREATE POLICY perfis_insert_lider_proprio_setor ON public.perfis FOR INSERT WITH CHECK (((public.meu_papel() = 'lider_setor'::public.papel) AND (papel = 'funcionario'::public.papel) AND (setor = public.meu_setor())));

CREATE POLICY perfis_select_admin ON public.perfis FOR SELECT USING ((public.meu_papel() = 'admin'::public.papel));

CREATE POLICY perfis_select_mesmo_setor ON public.perfis FOR SELECT USING ((setor = public.meu_setor()));

CREATE POLICY perfis_select_proprio ON public.perfis FOR SELECT USING ((id = auth.uid()));

CREATE POLICY registros_auditoria_select_admin ON public.registros_auditoria FOR SELECT USING ((public.meu_papel() = 'admin'::public.papel));

-- Grants de tabela (Supabase não concede mais por default): `authenticated` só recebe o que as
-- policies deste arquivo usam (o RLS filtra as linhas); `service_role` ignora RLS e fica com tudo.
grant select, insert on table public.perfis to authenticated;
grant all on table public.perfis to service_role;
grant select on table public.registros_auditoria to authenticated;
grant all on table public.registros_auditoria to service_role;

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on function public.alterar_papel_usuario(uuid, uuid, public.papel) from public, anon, authenticated;
grant execute on function public.alterar_papel_usuario(uuid, uuid, public.papel) to service_role;

revoke all on function public.finalizar_troca_senha(uuid) from public, anon, authenticated;
grant execute on function public.finalizar_troca_senha(uuid) to service_role;

revoke all on function public.registrar_acao_auditoria(uuid, uuid, public.setor_slug, text, text, public.resultado_acao) from public, anon, authenticated;
grant execute on function public.registrar_acao_auditoria(uuid, uuid, public.setor_slug, text, text, public.resultado_acao) to service_role;

revoke all on function public.registrar_auth_senha_alterada(uuid) from public, anon, authenticated;
grant execute on function public.registrar_auth_senha_alterada(uuid) to service_role;


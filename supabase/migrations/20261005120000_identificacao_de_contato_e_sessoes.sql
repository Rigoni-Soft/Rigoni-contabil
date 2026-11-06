-- Identificação do contato por telefone e sessões da URA.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

-- #41: posição do cliente no menu da URA entre uma mensagem e outra. Guarda SÓ a etapa,
-- o modo e a página — nunca dado do Cliente. A chave é um HMAC do telefone (não o número),
-- e linhas com mais de 10 min são descartadas na leitura e varridas a cada gravação.
-- (acrescentado em 20261005160000):
-- #43: etapas da identificação de número não cadastrado ("já é cliente?" e CNPJ). Só posição, sem dado.
-- (acrescentado em 20261006140000):
-- #50: etapa da nova tentativa de CNPJ não encontrado. Só posição, sem dado.
-- (acrescentado em 20261006150000):
-- #50: respostas inválidas seguidas na identificação (sim/não e CNPJ); ao passar do limite o cliente vai à recepção.
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

ALTER TABLE ONLY public.atendimento_sessoes
    ADD CONSTRAINT atendimento_sessoes_pkey PRIMARY KEY (chave);

-- Mesmo telefone em mais de um Cliente (revisão do PR #76, B2): a função devolve todos os
-- vínculos, e quem chama decide. Antes um `limit 1` escolhia um Cliente em silêncio. Mesmo
-- tipo de retorno, então `create or replace` mantém os grants.
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

ALTER TABLE public.atendimento_sessoes ENABLE ROW LEVEL SECURITY;

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on table public.atendimento_sessoes from anon, authenticated;
grant all on table public.atendimento_sessoes to service_role;

revoke all on function public.identificar_contato_por_telefone(text) from public, anon, authenticated;
grant execute on function public.identificar_contato_por_telefone(text) to service_role;


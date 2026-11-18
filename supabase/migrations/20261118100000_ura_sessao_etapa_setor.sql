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

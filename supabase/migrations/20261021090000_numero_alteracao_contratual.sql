-- Nº da alteração contratual: obrigatório e único por Cliente; "mais recente" = maior nº.
-- Sem produção e sem backfill (ADD COLUMN NOT NULL exige base vazia/resetada: `supabase db reset`).
ALTER TABLE public.cliente_alteracoes_contratuais
    ADD COLUMN numero integer NOT NULL,
    ADD CONSTRAINT cliente_alteracoes_contratuais_numero_check CHECK (numero > 0),
    ADD CONSTRAINT cliente_alteracoes_contratuais_cliente_id_numero_key UNIQUE (cliente_id, numero);

-- `criar_cliente` passa a ler `numero` de cada item de `p_alteracoes`; nº repetido no lote cai na
-- UNIQUE acima (23505) e desfaz o cadastro inteiro.
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
      (cliente_id, forma_envio, documento_obrigatorio, das_status, tem_parcelamento,
       parcelamento_status, observacoes_gerais)
    values
      (p_id, 'whatsapp', 'negativo', 'pendente', false, 'pendente', '');
  end if;
end;
$$;

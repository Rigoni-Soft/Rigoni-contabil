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
create or replace function public.criar_cliente(
  p_id uuid,
  p_empresa text,
  p_cnpj text,
  p_regime public.regime,
  p_contrato_social_caminho text,
  p_alteracoes jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.clientes (id, empresa, cnpj, regime, contrato_social_caminho)
  values (p_id, p_empresa, p_cnpj, p_regime, p_contrato_social_caminho);

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

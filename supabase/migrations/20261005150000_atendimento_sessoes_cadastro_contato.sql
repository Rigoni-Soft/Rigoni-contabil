-- #43: etapas do cadastro de contato novo na URA. `cliente_id` é o único dado de Cliente que a
-- sessão guarda (uuid opaco, sem FK: a sessão expira em 10 min e some sozinha).
alter table public.atendimento_sessoes
  drop constraint atendimento_sessoes_etapa_check,
  add constraint atendimento_sessoes_etapa_check check (
    etapa in ('tipo_documento', 'alteracao', 'ja_cliente', 'cnpj', 'aceite_cadastro', 'nome_cadastro')
  ),
  add column cliente_id uuid,
  add constraint atendimento_sessoes_cliente_id_check check (
    (etapa in ('aceite_cadastro', 'nome_cadastro')) = (cliente_id is not null)
  );

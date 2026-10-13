-- #50: etapa da nova tentativa de CNPJ não encontrado. Só posição, sem dado.
alter table public.atendimento_sessoes
  drop constraint atendimento_sessoes_etapa_check,
  add constraint atendimento_sessoes_etapa_check
    check (etapa in ('tipo_documento', 'alteracao', 'ja_cliente', 'cnpj', 'cnpj_nova_tentativa'));

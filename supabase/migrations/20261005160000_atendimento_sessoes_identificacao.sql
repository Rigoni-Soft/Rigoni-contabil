-- #43: etapas da identificação de número não cadastrado ("já é cliente?" e CNPJ). Só posição, sem dado.
alter table public.atendimento_sessoes
  drop constraint atendimento_sessoes_etapa_check,
  add constraint atendimento_sessoes_etapa_check
    check (etapa in ('tipo_documento', 'alteracao', 'ja_cliente', 'cnpj'));

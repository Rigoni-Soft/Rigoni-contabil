-- Decisão de produto (2026-09-29, testado manualmente via yarn dev): contrato
-- social deixa de ser obrigatório no cadastro de Cliente — atualiza a spec #24
-- ("Campos obrigatórios: Empresa, CNPJ, Regime, contrato social"), registrada
-- em comentário na issue #24. Alterações contratuais já eram opcionais.
alter table public.clientes alter column contrato_social_caminho drop not null;

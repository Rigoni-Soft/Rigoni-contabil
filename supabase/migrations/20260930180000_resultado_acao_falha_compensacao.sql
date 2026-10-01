-- Devolutiva técnica PR #61, ajuste residual: falha da própria compensação
-- (rollback) precisa virar um resultado de auditoria distinto de "falha" comum,
-- pra ficar filtrável no feed e virar o caminho de reconciliação manual.
alter type public.resultado_acao add value 'falha_compensacao';

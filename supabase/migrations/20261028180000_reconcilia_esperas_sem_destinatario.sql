-- #165: antes da espera dirigida, a espera de todo Setor era comum (fila_funcionario_id nulo). Agora só
-- a da Recepção é: fora dela, o Atendimento sem destinatário ninguém assume (assumir_atendimento
-- recusa). As esperas que já existiam passam ao destinatário que a regra do Setor aponta hoje
-- (Responsável do Cliente ou, sem ele, o Líder ativo). Sem destinatário elegível seguem nulas, só para
-- a supervisão, e ninguém as assume. Mantém ID, mensagens, fila_desde e auditoria; não atribui dono.
UPDATE public.atendimentos a
SET fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor)
WHERE a.status = 'em_andamento'
  AND a.funcionario_id IS NULL
  AND a.fila_funcionario_id IS NULL
  AND a.setor <> 'recepcao'
  AND public.destinatario_da_espera(a.cliente_id, a.setor) IS NOT NULL;

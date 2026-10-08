-- Revisão do PR #76 (I2): a escolha "1".."10" depende da lista exibida. A sessão passa a guardar
-- uma impressão digital (hash) da lista de alterações mostrada, para detectar inclusão/exclusão
-- entre a exibição e a resposta. Continua sem dado do Cliente: é só um hash.
-- Sessões de alteração abertas (vida máxima de 10 min) não têm a impressão e são descartadas.
delete from public.atendimento_sessoes where etapa = 'alteracao';

alter table public.atendimento_sessoes
  add column lista text,
  drop constraint atendimento_sessoes_check,
  add constraint atendimento_sessoes_check
    check ((etapa = 'alteracao') = (modo is not null and pagina is not null and lista is not null));

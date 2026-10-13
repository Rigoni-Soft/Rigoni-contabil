-- #50: respostas inválidas seguidas na identificação (sim/não e CNPJ); ao passar do limite o cliente vai à recepção.
alter table public.atendimento_sessoes
  add column invalidos integer not null default 0 check (invalidos >= 0);

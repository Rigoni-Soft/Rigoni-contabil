-- #50: CNPJs inválidos seguidos na identificação; ao passar do limite o cliente vai à recepção.
alter table public.atendimento_sessoes
  add column invalidos integer not null default 0 check (invalidos >= 0);

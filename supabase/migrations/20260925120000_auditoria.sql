-- Modulo auditoria (ticket #29): registro imutavel de acoes que mudam estado.

create type public.resultado_acao as enum ('sucesso', 'falha');

create table public.registros_auditoria (
  id uuid primary key,
  ator uuid not null,
  setor public.setor_slug not null,
  acao text not null,
  alvo text not null,
  resultado public.resultado_acao not null,
  criado_em timestamptz not null default now()
);

alter table public.registros_auditoria enable row level security;

-- Cada usuario so registra acoes em seu proprio nome (reforca a camada de aplicacao).
create policy "registros_auditoria_insert_proprio_ator"
  on public.registros_auditoria for insert
  with check (ator = auth.uid());

-- Feed bruto e so pra Admin (ticket #29). Sem policy de update/delete: log imutavel.
create policy "registros_auditoria_select_admin"
  on public.registros_auditoria for select
  using (public.meu_papel() = 'admin');

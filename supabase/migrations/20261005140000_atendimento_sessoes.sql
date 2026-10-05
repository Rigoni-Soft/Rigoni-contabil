-- #41: posição do cliente no menu da URA entre uma mensagem e outra. Guarda SÓ a etapa,
-- o modo e a página — nunca dado do Cliente. A chave é um HMAC do telefone (não o número),
-- e linhas com mais de 10 min são descartadas na leitura e varridas a cada gravação.
create table public.atendimento_sessoes (
  chave text primary key,
  etapa text not null check (etapa in ('tipo_documento', 'alteracao')),
  modo text check (modo in ('alteracoes', 'ambos')),
  pagina integer check (pagina >= 1),
  atualizado_em timestamptz not null default now(),
  check ((etapa = 'alteracao') = (modo is not null and pagina is not null))
);

-- RLS ligada e sem policy: só o service_role (que ignora RLS) enxerga a tabela.
alter table public.atendimento_sessoes enable row level security;
revoke all on table public.atendimento_sessoes from anon, authenticated;

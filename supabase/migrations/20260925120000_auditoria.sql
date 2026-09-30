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

-- Devolutiva tecnica PR #60, bloqueador 01: sem policy de INSERT, a tabela fica
-- fechada pra qualquer escrita direta via Data API (mesmo com `ator = auth.uid()`,
-- um usuario autenticado ainda escolheria setor/acao/alvo/resultado/criado_em
-- livremente). A unica porta de escrita e a funcao abaixo (SECURITY DEFINER),
-- que ignora qualquer valor de ator/criado_em vindo do chamador e usa
-- auth.uid()/now() do proprio banco -- autenticidade garantida no servidor,
-- nao so por policy.
create or replace function public.registrar_acao_auditoria(
  p_id uuid,
  p_setor public.setor_slug,
  p_acao text,
  p_alvo text,
  p_resultado public.resultado_acao
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (p_id, auth.uid(), p_setor, p_acao, p_alvo, p_resultado, now());
end;
$$;

-- Feed bruto e so pra Admin (ticket #29). Sem policy de update/delete: log imutavel.
create policy "registros_auditoria_select_admin"
  on public.registros_auditoria for select
  using (public.meu_papel() = 'admin');

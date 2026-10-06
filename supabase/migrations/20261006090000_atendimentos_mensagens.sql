-- #44: Atendimento e Mensagem persistidos + atribuição direta por Balanceamento mensal.
-- `funcionario_id` null = ainda sem Funcionário humano (a URA sozinha não conta no balanceamento).
create type public.status_atendimento as enum ('em_andamento', 'encerrado');
create type public.autor_mensagem as enum ('contato', 'ura', 'funcionario');

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  -- só dígitos nacionais: identifica o Atendimento em andamento do número, em qualquer formato.
  chave_telefone text not null,
  cliente_id uuid references public.clientes (id),
  setor public.setor_slug not null,
  funcionario_id uuid references public.perfis (id),
  status public.status_atendimento not null default 'em_andamento',
  criado_em timestamptz not null default now(),
  assumido_em timestamptz,
  check ((funcionario_id is null) = (assumido_em is null))
);
-- Único: um número só tem um Atendimento em andamento; a corrida entre dois webhooks falha aqui
-- e a reentrega cai no caminho de anexar.
create unique index atendimentos_em_andamento_telefone on public.atendimentos (chave_telefone)
  where status = 'em_andamento';
create index atendimentos_funcionario_mes on public.atendimentos (funcionario_id, assumido_em);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos (id) on delete cascade,
  autor public.autor_mensagem not null,
  texto text not null,
  criado_em timestamptz not null default clock_timestamp()
);
create index mensagens_atendimento on public.mensagens (atendimento_id, criado_em);

-- RLS ligada e sem policy: só o service_role enxerga (telas de Funcionário entram depois).
alter table public.atendimentos enable row level security;
alter table public.mensagens enable row level security;
revoke all on table public.atendimentos, public.mensagens from anon, authenticated;

-- Funcionários do Setor com a contagem do mês (fuso de Brasília) e se estão livres
-- (nenhum Atendimento em andamento). Ordem estável: nome, id.
create or replace function public.funcionarios_do_setor(p_setor public.setor_slug)
returns table (id uuid, atendimentos_no_mes bigint, livre boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    count(a.id) filter (
      where a.assumido_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
                             at time zone 'America/Sao_Paulo'
    ),
    not coalesce(bool_or(a.status = 'em_andamento'), false)
  from public.perfis p
  left join public.atendimentos a on a.funcionario_id = p.id
  where p.setor = p_setor and p.papel = 'funcionario'
  group by p.id, p.nome
  order by p.nome, p.id;
$$;
revoke all on function public.funcionarios_do_setor(public.setor_slug) from public, anon, authenticated;

-- Atendimento + Mensagens numa transação só. O lock por Setor serializa as atribuições: se o
-- Funcionário escolhido já foi ocupado por outro Atendimento, devolve null sem gravar nada
-- (quem chama escolhe de novo).
create or replace function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if p_funcionario_id is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_id and status = 'em_andamento'
  ) then
    return null;
  end if;

  insert into public.atendimentos (telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em)
  values (
    p_telefone, p_chave, p_cliente_id, p_setor, p_funcionario_id,
    case when p_funcionario_id is null then null else now() end
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return v_id;
end;
$$;
revoke all on function public.abrir_atendimento(text, text, uuid, public.setor_slug, uuid, jsonb)
  from public, anon, authenticated;

-- Mensagem de quem já tem Atendimento em andamento entra nele (o mais recente). false = não há.
create or replace function public.anexar_mensagem_atendimento(
  p_chave text,
  p_autor public.autor_mensagem,
  p_texto text
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.atendimentos
  where chave_telefone = p_chave and status = 'em_andamento'
  order by criado_em desc
  limit 1;
  if v_id is null then
    return false;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto) values (v_id, p_autor, p_texto);
  return true;
end;
$$;
revoke all on function public.anexar_mensagem_atendimento(text, public.autor_mensagem, text)
  from public, anon, authenticated;

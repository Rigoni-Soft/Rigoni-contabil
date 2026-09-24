-- Modulo usuarios: papel, setor e perfil vinculado a auth.users, com RLS.

create type public.papel as enum ('admin', 'lider_setor', 'funcionario');

-- Setores do organograma real, exceto Patriki (raiz, nao e setor) e Expedicao.
-- Presumido/Real renomeado para Tributario. Zeladoria (subtime de Financeiro)
-- nao vira setor proprio de login nesta rodada -- decisao a confirmar com o usuario.
create type public.setor_slug as enum (
  'rh',
  'tributario',
  'simples_nacional',
  'contabil',
  'societario',
  'condominios',
  'financeiro',
  'administrativo',
  'contabil_externo',
  'ti',
  'recepcao'
);

-- ponytail: email duplicado de auth.users pra evitar chamada admin API no repositorio;
-- se o e-mail puder ser trocado depois, sincronizar via trigger quando isso virar requisito.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  papel public.papel not null,
  setor public.setor_slug not null,
  created_at timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Funcoes SECURITY DEFINER: leem o proprio perfil sem disparar recursao de RLS.
create or replace function public.meu_papel()
returns public.papel
language sql
security definer
stable
set search_path = public
as $$
  select papel from public.perfis where id = auth.uid();
$$;

create or replace function public.meu_setor()
returns public.setor_slug
language sql
security definer
stable
set search_path = public
as $$
  select setor from public.perfis where id = auth.uid();
$$;

create policy "perfis_select_proprio"
  on public.perfis for select
  using (id = auth.uid());

create policy "perfis_select_admin"
  on public.perfis for select
  using (public.meu_papel() = 'admin');

create policy "perfis_select_mesmo_setor"
  on public.perfis for select
  using (setor = public.meu_setor());

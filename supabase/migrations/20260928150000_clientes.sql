-- Ticket #33: Cadastro de Cliente pelo Admin.

create type public.regime as enum ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei');

create table public.clientes (
  id uuid primary key,
  empresa text not null,
  cnpj text not null unique,
  regime public.regime not null,
  contrato_social_caminho text not null,
  criado_em timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "clientes_select_admin"
  on public.clientes for select
  using (public.meu_papel() = 'admin');

create policy "clientes_insert_admin"
  on public.clientes for insert
  with check (public.meu_papel() = 'admin');

create table public.cliente_alteracoes_contratuais (
  id uuid primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  data date not null,
  arquivo_caminho text not null,
  criado_em timestamptz not null default now()
);

alter table public.cliente_alteracoes_contratuais enable row level security;

create policy "cliente_alteracoes_select_admin"
  on public.cliente_alteracoes_contratuais for select
  using (public.meu_papel() = 'admin');

create policy "cliente_alteracoes_insert_admin"
  on public.cliente_alteracoes_contratuais for insert
  with check (public.meu_papel() = 'admin');

-- Cliente e suas Alterações contratuais são o mesmo agregado (raiz + entidade
-- filha, arquitetura.md seção 3.5): uma função transacional evita gravação
-- parcial (Cliente salvo sem as Alterações, ou vice-versa). `security invoker`
-- porque as policies acima já autorizam o próprio Admin chamador, sem precisar
-- contornar RLS (diferente de `marcar_senha_trocada`, do #31, que é definer).
create or replace function public.criar_cliente(
  p_id uuid,
  p_empresa text,
  p_cnpj text,
  p_regime public.regime,
  p_contrato_social_caminho text,
  p_alteracoes jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.clientes (id, empresa, cnpj, regime, contrato_social_caminho)
  values (p_id, p_empresa, p_cnpj, p_regime, p_contrato_social_caminho);

  insert into public.cliente_alteracoes_contratuais (id, cliente_id, data, arquivo_caminho)
  select
    (item ->> 'id')::uuid,
    p_id,
    (item ->> 'data')::date,
    item ->> 'arquivoCaminho'
  from jsonb_array_elements(p_alteracoes) as item;
end;
$$;

-- Storage: bucket privado para os documentos jurídicos do Cliente (contrato
-- social e alterações contratuais). Sem acesso público — só Admin, via as
-- policies de storage.objects abaixo (arquitetura.md, seção 3.9: Storage é
-- porta OUT como qualquer outra, com RLS defendendo em profundidade).
insert into storage.buckets (id, name, public)
values ('documentos-clientes', 'documentos-clientes', false)
on conflict (id) do nothing;

create policy "documentos_clientes_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'documentos-clientes' and public.meu_papel() = 'admin');

create policy "documentos_clientes_select_admin"
  on storage.objects for select
  using (bucket_id = 'documentos-clientes' and public.meu_papel() = 'admin');

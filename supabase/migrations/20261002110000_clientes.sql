-- Ticket #33: Cadastro de Cliente pelo Admin.

create type public.regime as enum ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei');

create table public.clientes (
  id uuid primary key,
  empresa text not null,
  cnpj text not null unique,
  regime public.regime not null,
  -- Opcional (decisao de produto, 2026-09-29, testado manualmente via yarn
  -- dev): atualiza a spec #24 ("Campos obrigatorios: Empresa, CNPJ, Regime,
  -- contrato social"), registrada em comentario na issue #24. Consolidado
  -- aqui (era uma migration separada, 20260929140000) porque nao ha nenhuma
  -- dependencia entre a criacao da tabela e essa relaxacao de constraint --
  -- ambas nasceram na mesma branch (#33), e declarar nullable desde o
  -- inicio e equivalente a criar not-null e relaxar duas migrations depois.
  contrato_social_caminho text,
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
-- Devolutiva PR #64, ponto 7: PDF/DOCX e 10 MB também no próprio bucket (mesma
-- regra do Zod e do limite da Server Action), pra um upload direto ao Storage
-- por uma sessão Admin não contornar a validação da aplicação.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-clientes', 'documentos-clientes', false, 10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "documentos_clientes_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'documentos-clientes' and public.meu_papel() = 'admin');

create policy "documentos_clientes_select_admin"
  on storage.objects for select
  using (bucket_id = 'documentos-clientes' and public.meu_papel() = 'admin');

-- Devolutiva PR #64, ponto 3: compensação do cadastro (remove uploads quando
-- uma etapa posterior falha) usa a sessão do próprio Admin, sem service_role.
create policy "documentos_clientes_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'documentos-clientes' and public.meu_papel() = 'admin');

-- Devolutiva PR #64, ponto 4: a auditoria de sucesso nasce na mesma transação
-- do INSERT em `clientes`. Se o evento não puder ser gravado, o cadastro inteiro
-- é desfeito: não existe Cliente sem `cliente.criar`. Ator e setor vêm da sessão
-- do banco (nunca do chamador), e o gatilho vale pra qualquer caminho de INSERT —
-- inclusive as versões futuras de `criar_cliente`. Sem sessão (auth.uid() nulo:
-- seed, migration, service_role) não há ator a registrar.
create function public.auditar_cliente_criado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.criar', new.cnpj, 'sucesso', now());
  end if;
  return new;
end;
$$;

revoke execute on function public.auditar_cliente_criado() from public, anon, authenticated;

create trigger clientes_auditar_criacao
  after insert on public.clientes
  for each row execute function public.auditar_cliente_criado();

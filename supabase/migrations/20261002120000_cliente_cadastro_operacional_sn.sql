-- Ticket #34: Funcionário do Simples Nacional edita cadastro operacional de Cliente.
--
-- Decisão arquitetural (confirmada com o usuário): campos operacionais em
-- TABELA SEPARADA, não em `clientes`. RLS no Postgres é por linha, não por
-- coluna — se os campos entrassem em `clientes`, qualquer policy de UPDATE
-- que liberasse o Funcionário SN liberaria a linha inteira, incluindo
-- contrato_social_caminho (dado jurídico, só Admin deve tocar).

create type public.forma_envio as enum ('whatsapp', 'email', 'whatsapp_e_email');
create type public.documento_obrigatorio_status as enum ('positivo', 'negativo', 'nao_se_aplica');
create type public.das_status as enum ('pendente', 'pronto', 'enviado', 'sem_movimento');
create type public.parcelamento_status as enum ('pendente', 'enviado', 'interno');

create table public.cliente_cadastro_operacional_sn (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  forma_envio public.forma_envio not null default 'whatsapp',
  documento_obrigatorio public.documento_obrigatorio_status,
  das_status public.das_status,
  data_envio_das date,
  tem_parcelamento boolean not null default false,
  parcelamento_status public.parcelamento_status,
  observacoes_gerais text not null default '',
  atualizado_em timestamptz not null default now()
);

create table public.cliente_contatos (
  id uuid primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  telefone text not null,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Garante no máximo 1 contato padrão por Cliente. Índice parcial, não CHECK
-- — CHECK não enxerga outras linhas da mesma tabela.
create unique index cliente_contatos_um_padrao_por_cliente
  on public.cliente_contatos (cliente_id)
  where (padrao);

create table public.cliente_atividades_mensais (
  id uuid primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  ano_mes date not null, -- sempre dia 01, ex. '2026-09-01'; só o mês corrente é editável (#34)
  industria boolean not null default false,
  comercio boolean not null default false,
  servico boolean not null default false,
  unique (cliente_id, ano_mes)
);

alter table public.cliente_cadastro_operacional_sn enable row level security;
alter table public.cliente_contatos enable row level security;
alter table public.cliente_atividades_mensais enable row level security;

-- `clientes_select_admin` (#33) restringe SELECT em `clientes` só a Admin.
-- Critério de aceite do #34 ("Outros Setores conseguem visualizar... o
-- cadastro básico") exige liberar SELECT pra qualquer perfil autenticado.
-- Policies de SELECT se combinam com OR no Postgres — esta soma à do #33
-- sem precisar editar a migration antiga.
create policy "clientes_select_qualquer_perfil"
  on public.clientes for select
  using (public.meu_papel() is not null);

create policy "cliente_cadastro_operacional_select_qualquer_perfil"
  on public.cliente_cadastro_operacional_sn for select
  using (public.meu_papel() is not null);

create policy "cliente_contatos_select_qualquer_perfil"
  on public.cliente_contatos for select
  using (public.meu_papel() is not null);

create policy "cliente_atividades_select_qualquer_perfil"
  on public.cliente_atividades_mensais for select
  using (public.meu_papel() is not null);

-- INSERT/UPDATE/DELETE: só Admin ou Funcionário do setor simples_nacional.
create policy "cliente_cadastro_operacional_upsert_sn"
  on public.cliente_cadastro_operacional_sn for insert
  with check (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

create policy "cliente_cadastro_operacional_update_sn"
  on public.cliente_cadastro_operacional_sn for update
  using (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  )
  with check (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

create policy "cliente_contatos_insert_sn"
  on public.cliente_contatos for insert
  with check (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

create policy "cliente_contatos_delete_sn"
  on public.cliente_contatos for delete
  using (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

create policy "cliente_atividades_upsert_sn"
  on public.cliente_atividades_mensais for insert
  with check (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

create policy "cliente_atividades_update_sn"
  on public.cliente_atividades_mensais for update
  using (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  )
  with check (
    public.meu_papel() = 'admin'
    or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
  );

-- cliente_cadastro_operacional_sn + cliente_contatos + cliente_atividades_mensais
-- são extensão do mesmo agregado Cliente (arquitetura.md seção 3.5) — uma RPC
-- transacional evita gravação parcial entre as 3 tabelas. `security invoker`:
-- as policies acima já autorizam quem chama.
create or replace function public.editar_cadastro_operacional_cliente(
  p_cliente_id uuid,
  p_forma_envio public.forma_envio,
  p_documento_obrigatorio public.documento_obrigatorio_status,
  p_das_status public.das_status,
  p_data_envio_das date,
  p_tem_parcelamento boolean,
  p_parcelamento_status public.parcelamento_status,
  p_observacoes_gerais text,
  p_contatos jsonb,
  p_ano_mes date,
  p_industria boolean,
  p_comercio boolean,
  p_servico boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.cliente_cadastro_operacional_sn
    (cliente_id, forma_envio, documento_obrigatorio, das_status, data_envio_das,
     tem_parcelamento, parcelamento_status, observacoes_gerais, atualizado_em)
  values
    (p_cliente_id, p_forma_envio, p_documento_obrigatorio, p_das_status, p_data_envio_das,
     p_tem_parcelamento, p_parcelamento_status, p_observacoes_gerais, now())
  on conflict (cliente_id) do update set
    forma_envio = excluded.forma_envio,
    documento_obrigatorio = excluded.documento_obrigatorio,
    das_status = excluded.das_status,
    data_envio_das = excluded.data_envio_das,
    tem_parcelamento = excluded.tem_parcelamento,
    parcelamento_status = excluded.parcelamento_status,
    observacoes_gerais = excluded.observacoes_gerais,
    atualizado_em = now();

  -- Contatos: substituição total (delete-then-insert), não diff campo a
  -- campo — conjunto pequeno (padrão + poucos adicionais), sem exigência de
  -- histórico na spec.
  delete from public.cliente_contatos where cliente_id = p_cliente_id;
  insert into public.cliente_contatos (id, cliente_id, nome, telefone, padrao)
  select
    coalesce((item ->> 'id')::uuid, gen_random_uuid()),
    p_cliente_id,
    item ->> 'nome',
    item ->> 'telefone',
    (item ->> 'padrao')::boolean
  from jsonb_array_elements(p_contatos) as item;

  insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
  values (gen_random_uuid(), p_cliente_id, p_ano_mes, p_industria, p_comercio, p_servico)
  on conflict (cliente_id, ano_mes) do update set
    industria = excluded.industria,
    comercio = excluded.comercio,
    servico = excluded.servico;
end;
$$;

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

-- Devolutiva técnica PR #69: o índice parcial acima só cobre o contato padrão;
-- leitura e o delete-then-insert da RPC varrem todos os contatos do Cliente.
create index cliente_contatos_cliente_id_idx on public.cliente_contatos (cliente_id);

create table public.cliente_atividades_mensais (
  id uuid primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  -- sempre dia 01, ex. '2026-09-01'; só o mês corrente é editável (#34).
  -- CHECK (PR #69): a regra deixa de depender só de comentário/código.
  ano_mes date not null check (extract(day from ano_mes) = 1),
  industria boolean not null default false,
  comercio boolean not null default false,
  servico boolean not null default false,
  unique (cliente_id, ano_mes)
);

alter table public.cliente_cadastro_operacional_sn enable row level security;
alter table public.cliente_contatos enable row level security;
alter table public.cliente_atividades_mensais enable row level security;

-- Devolutiva técnica PR #69, ponto 2: `meu_papel()`/`meu_setor()` só devolvem
-- NULL depois que a senha provisória VENCE (ADR 0002); durante as 48h de
-- janela, uma conta que ainda não trocou a senha satisfaz qualquer policy de
-- papel via Data API. As policies de dados de negócio deste ticket exigem
-- primeiro acesso finalizado. Helper específico, sem mexer em meu_papel()
-- (que o #29/#30/#31 reusam): o SELECT do próprio perfil (`perfis_select_proprio`,
-- `id = auth.uid()`) não passa por aqui e segue liberado pro fluxo de troca.
create or replace function public.acesso_liberado()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and senha_trocada_em is not null
  );
$$;

-- Devolutiva técnica PR #69, ponto 1: a policy ampla de SELECT em `clientes`
-- (qualquer perfil) expunha `contrato_social_caminho` pela Data API — RLS é por
-- linha, não por coluna. `clientes_select_admin` (#33) permanece como a única
-- policy da tabela. Não-Admin lê só esta projeção (sem contrato social): a view
-- roda com os privilégios do dono (security_invoker desligado) e filtra o
-- acesso por conta própria.
create view public.clientes_basico
with (security_invoker = false) as
select id, empresa, cnpj, regime
from public.clientes
where public.acesso_liberado() and public.meu_papel() is not null;

revoke all on public.clientes_basico from public, anon;
grant select on public.clientes_basico to authenticated;

create policy "cliente_cadastro_operacional_select_qualquer_perfil"
  on public.cliente_cadastro_operacional_sn for select
  using (public.acesso_liberado() and public.meu_papel() is not null);

create policy "cliente_contatos_select_qualquer_perfil"
  on public.cliente_contatos for select
  using (public.acesso_liberado() and public.meu_papel() is not null);

create policy "cliente_atividades_select_qualquer_perfil"
  on public.cliente_atividades_mensais for select
  using (public.acesso_liberado() and public.meu_papel() is not null);

-- INSERT/UPDATE/DELETE: só Admin ou Funcionário do setor simples_nacional.
create policy "cliente_cadastro_operacional_upsert_sn"
  on public.cliente_cadastro_operacional_sn for insert
  with check (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

create policy "cliente_cadastro_operacional_update_sn"
  on public.cliente_cadastro_operacional_sn for update
  using (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  )
  with check (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

create policy "cliente_contatos_insert_sn"
  on public.cliente_contatos for insert
  with check (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

create policy "cliente_contatos_delete_sn"
  on public.cliente_contatos for delete
  using (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

create policy "cliente_atividades_upsert_sn"
  on public.cliente_atividades_mensais for insert
  with check (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

create policy "cliente_atividades_update_sn"
  on public.cliente_atividades_mensais for update
  using (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  )
  with check (
    public.acesso_liberado()
    and (
      public.meu_papel() = 'admin'
      or (public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional')
    )
  );

-- cliente_cadastro_operacional_sn + cliente_contatos + cliente_atividades_mensais
-- são extensão do mesmo agregado Cliente (arquitetura.md seção 3.5) — uma RPC
-- transacional evita gravação parcial entre as 3 tabelas. `security invoker`:
-- as policies acima já autorizam quem chama.
-- (auditoria de sucesso: ver trigger no fim deste arquivo, ponto 3 da PR #69)
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

-- Devolutiva técnica PR #69, ponto 3: a auditoria de sucesso nasce na mesma
-- transação da edição (como `cliente.criar` no #33). A RPC sempre grava a
-- Atividade do mês (insert OU update, nunca os dois): um gatilho nessa escrita
-- produz exatamente um evento por edição, e se o evento não puder ser gravado a
-- edição inteira é desfeita — não existe edição sem `cliente.editar-operacional`.
-- Ator e setor vêm da sessão do banco, nunca do chamador. `registrar_acao_auditoria`
-- é só service_role (PR #61), por isso o gatilho (definer) insere direto.
create function public.auditar_cadastro_operacional_editado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.editar-operacional',
      (select cnpj from public.clientes where id = new.cliente_id), 'sucesso', now()
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.auditar_cadastro_operacional_editado() from public, anon, authenticated;

create trigger cliente_atividades_auditar_edicao
  after insert or update on public.cliente_atividades_mensais
  for each row execute function public.auditar_cadastro_operacional_editado();

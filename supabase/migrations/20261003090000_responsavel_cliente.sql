-- Ticket #65: Responsável por Cliente (Dashboard SN).
--
-- Um Cliente tem no máximo um Responsável (Funcionário do Simples Nacional),
-- atribuído só pelo Líder do setor. Funcionário SN passa a enxergar/editar só
-- os Clientes pelos quais é responsável — garantido aqui por RLS, não só na UI.

alter table public.cliente_cadastro_operacional_sn
  add column responsavel_id uuid references public.perfis (id) on delete set null;

-- SECURITY DEFINER: as policies abaixo consultam a própria tabela
-- cliente_cadastro_operacional_sn; sem isso a policy recursaria nela mesma.
create function public.sou_responsavel_do_cliente(p_cliente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.cliente_cadastro_operacional_sn
    where cliente_id = p_cliente_id and responsavel_id = auth.uid()
  );
$$;

create function public.pode_ver_cliente(p_cliente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- acesso_liberado(): primeiro acesso finalizado (PR #69, ADR 0002).
  select public.acesso_liberado() and case
    when public.meu_papel() is null then false
    when public.meu_papel() = 'funcionario' and public.meu_setor() = 'simples_nacional'
      then public.sou_responsavel_do_cliente(p_cliente_id)
    else true
  end;
$$;

create function public.pode_editar_cadastro_operacional(p_cliente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.acesso_liberado() and coalesce(case public.meu_papel()
    when 'admin' then true
    when 'lider_setor' then public.meu_setor() = 'simples_nacional'
    when 'funcionario' then
      public.meu_setor() = 'simples_nacional' and public.sou_responsavel_do_cliente(p_cliente_id)
    else false
  end, false);
$$;

-- SELECT: substitui "qualquer perfil" (#34) — Funcionário SN só vê o que é dele.
-- `clientes` segue só Admin (PR #69, contrato social): a visibilidade por
-- Responsável vale na projeção `clientes_basico`, que é o que não-Admin lê.
create or replace view public.clientes_basico
with (security_invoker = false) as
select id, empresa, cnpj, regime
from public.clientes
where public.pode_ver_cliente(id);

drop policy "cliente_cadastro_operacional_select_qualquer_perfil"
  on public.cliente_cadastro_operacional_sn;
create policy "cliente_cadastro_operacional_select_qualquer_perfil"
  on public.cliente_cadastro_operacional_sn for select
  using (public.pode_ver_cliente(cliente_id));

drop policy "cliente_contatos_select_qualquer_perfil" on public.cliente_contatos;
create policy "cliente_contatos_select_qualquer_perfil"
  on public.cliente_contatos for select
  using (public.pode_ver_cliente(cliente_id));

drop policy "cliente_atividades_select_qualquer_perfil" on public.cliente_atividades_mensais;
create policy "cliente_atividades_select_qualquer_perfil"
  on public.cliente_atividades_mensais for select
  using (public.pode_ver_cliente(cliente_id));

-- Escrita: Admin, Líder do SN, ou Funcionário SN responsável pelo Cliente.
drop policy "cliente_cadastro_operacional_upsert_sn" on public.cliente_cadastro_operacional_sn;
create policy "cliente_cadastro_operacional_upsert_sn"
  on public.cliente_cadastro_operacional_sn for insert
  with check (public.pode_editar_cadastro_operacional(cliente_id));

drop policy "cliente_cadastro_operacional_update_sn" on public.cliente_cadastro_operacional_sn;
create policy "cliente_cadastro_operacional_update_sn"
  on public.cliente_cadastro_operacional_sn for update
  using (public.pode_editar_cadastro_operacional(cliente_id))
  with check (public.pode_editar_cadastro_operacional(cliente_id));

drop policy "cliente_contatos_insert_sn" on public.cliente_contatos;
create policy "cliente_contatos_insert_sn"
  on public.cliente_contatos for insert
  with check (public.pode_editar_cadastro_operacional(cliente_id));

drop policy "cliente_contatos_delete_sn" on public.cliente_contatos;
create policy "cliente_contatos_delete_sn"
  on public.cliente_contatos for delete
  using (public.pode_editar_cadastro_operacional(cliente_id));

drop policy "cliente_atividades_upsert_sn" on public.cliente_atividades_mensais;
create policy "cliente_atividades_upsert_sn"
  on public.cliente_atividades_mensais for insert
  with check (public.pode_editar_cadastro_operacional(cliente_id));

drop policy "cliente_atividades_update_sn" on public.cliente_atividades_mensais;
create policy "cliente_atividades_update_sn"
  on public.cliente_atividades_mensais for update
  using (public.pode_editar_cadastro_operacional(cliente_id))
  with check (public.pode_editar_cadastro_operacional(cliente_id));

-- RLS é por linha: a policy de UPDATE acima libera a linha inteira pro
-- Funcionário responsável, incluindo responsavel_id. Este trigger fecha a
-- coluna: só o Líder do SN muda o Responsável, e só pra Funcionário do SN.
-- Sem auth.uid() (service_role/migrations) é o próprio servidor confiável.
create function public.proteger_responsavel_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.responsavel_id is null then
    return new;
  end if;

  -- Sem auth.uid() (service_role/migrations) o chamador é o servidor confiável:
  -- pula a checagem de papel, mas a elegibilidade abaixo vale pra todos.
  if auth.uid() is not null
     and (public.meu_papel() is distinct from 'lider_setor'
          or public.meu_setor() is distinct from 'simples_nacional') then
    raise exception 'Só o Líder do Simples Nacional atribui o Responsável.' using errcode = '42501';
  end if;

  if new.responsavel_id is not null and not exists (
    select 1 from public.perfis
    where id = new.responsavel_id and papel = 'funcionario' and setor = 'simples_nacional'
  ) then
    raise exception 'O Responsável deve ser Funcionário do Simples Nacional.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger cliente_cadastro_operacional_proteger_responsavel
  before insert or update on public.cliente_cadastro_operacional_sn
  for each row execute function public.proteger_responsavel_cliente();

-- Helpers só pra quem está logado (as policies rodam como `authenticated`).
revoke execute on function public.sou_responsavel_do_cliente(uuid) from public, anon;
revoke execute on function public.pode_ver_cliente(uuid) from public, anon;
revoke execute on function public.pode_editar_cadastro_operacional(uuid) from public, anon;
grant execute on function public.sou_responsavel_do_cliente(uuid) to authenticated;
grant execute on function public.pode_ver_cliente(uuid) to authenticated;
grant execute on function public.pode_editar_cadastro_operacional(uuid) to authenticated;

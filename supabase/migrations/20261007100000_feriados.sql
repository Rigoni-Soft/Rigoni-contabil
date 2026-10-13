-- #72: feriados estaduais e municipais cadastrados pelo Admin (os nacionais ficam no código).
-- Fora do expediente a URA só avisa o horário; esta tabela decide quais dias úteis contam como
-- feriado. A webhook lê com service_role; a tela do Admin escreve com a sessão dele.
create table public.feriados (
  data date primary key,
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  criado_em timestamptz not null default now()
);

alter table public.feriados enable row level security;

-- acesso_liberado() exige a troca de senha concluída; `meu_papel()` sozinho aceita o Admin ainda
-- na senha provisória (devolutiva PR #82, B1).
create policy "feriados_select_admin"
  on public.feriados for select
  using (public.acesso_liberado() and public.meu_papel() = 'admin');
create policy "feriados_insert_admin"
  on public.feriados for insert
  with check (public.acesso_liberado() and public.meu_papel() = 'admin');
create policy "feriados_delete_admin"
  on public.feriados for delete
  using (public.acesso_liberado() and public.meu_papel() = 'admin');

-- Mesma ideia de `auditar_cliente_criado`: o evento nasce na transação da escrita, com ator e
-- setor da sessão do banco. Sem sessão (seed, migration, service_role) não há ator a registrar.
create function public.auditar_feriado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(),
      case tg_op when 'INSERT' then 'feriado.cadastrar' else 'feriado.remover' end,
      coalesce(new.data, old.data)::text, 'sucesso', now()
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.auditar_feriado() from public, anon, authenticated;

create trigger feriados_auditar
  after insert or delete on public.feriados
  for each row execute function public.auditar_feriado();

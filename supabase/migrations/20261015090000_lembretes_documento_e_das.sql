-- #52: job de lembrete de documento + envio de DAS (dias 01/05/10/15).

-- Alertas ao setor, lidos pelo painel do Funcionário. Um alerta aberto por Cliente e tipo: o job
-- roda quatro vezes por mês e não empilha o mesmo aviso até alguém resolvê-lo.
create type public.tipo_alerta_setor as enum ('das_pendente', 'falha_envio', 'contato_ausente');

create table public.alertas_setor (
  id uuid primary key default gen_random_uuid(),
  setor public.setor_slug not null,
  tipo public.tipo_alerta_setor not null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  mensagem text not null,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create unique index alertas_setor_um_aberto_por_cliente_e_tipo
  on public.alertas_setor (cliente_id, tipo)
  where resolvido_em is null;
create index alertas_setor_abertos on public.alertas_setor (setor, criado_em desc)
  where resolvido_em is null;

alter table public.alertas_setor enable row level security;

-- Quem escreve é o job (service_role). O Funcionário só lê os alertas do próprio setor; o Admin lê
-- todos.
create policy "alertas_setor_select"
  on public.alertas_setor for select
  using (
    public.acesso_liberado()
    and (public.meu_papel() = 'admin' or setor = public.meu_setor())
  );

-- Guias do DAS publicadas para o provedor de mensagem/e-mail buscar por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias-fiscais', 'guias-fiscais', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Clientes com Cadastro operacional do Simples Nacional, o contato padrão (telefone já com 55 e só
-- dígitos, como o webhook o recebe) e a última Mensagem do contato, que decide a janela de 24h.
create function public.clientes_para_lembrete()
returns table (
  cliente_id uuid,
  cnpj text,
  empresa text,
  forma_envio public.forma_envio,
  documento_obrigatorio public.documento_obrigatorio_status,
  das_status public.das_status,
  contato_nome text,
  contato_telefone text,
  ultima_mensagem_do_contato_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.cnpj, c.empresa, o.forma_envio, o.documento_obrigatorio, o.das_status,
         ct.nome, ct.chave,
         (select max(m.criado_em)
            from public.mensagens m
            join public.atendimentos a on a.id = m.atendimento_id
           where a.chave_telefone = ct.chave and m.autor = 'contato')
  from public.cliente_cadastro_operacional_sn o
  join public.clientes c on c.id = o.cliente_id
  left join lateral (
    select p.nome,
           case when length(d.digitos) in (10, 11) then '55' || d.digitos else d.digitos end as chave
    from public.cliente_contatos p,
         lateral (select regexp_replace(p.telefone, '\D', '', 'g') as digitos) d
    where p.cliente_id = c.id and p.padrao
  ) ct on true
  order by c.empresa, c.id;
$$;

-- DAS pronto → enviado com a data, só se ainda estiver pronto; auditado com a URA como ator (o
-- gatilho do cadastro não audita sem sessão de usuário).
create function public.marcar_das_enviado_automaticamente(p_cliente_id uuid, p_data date)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cnpj text;
begin
  update public.cliente_cadastro_operacional_sn
     set das_status = 'enviado', data_envio_das = p_data, atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'pronto';
  if not found then
    return false;
  end if;
  select cnpj into v_cnpj from public.clientes where id = p_cliente_id;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'simples_nacional',
    'cliente.enviar-das-automatico', v_cnpj, 'sucesso', now()
  );
  return true;
end;
$$;

revoke all on function public.clientes_para_lembrete() from public, anon, authenticated;
grant execute on function public.clientes_para_lembrete() to service_role;
revoke all on function public.marcar_das_enviado_automaticamente(uuid, date)
  from public, anon, authenticated;
grant execute on function public.marcar_das_enviado_automaticamente(uuid, date) to service_role;

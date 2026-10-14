-- #52: job de lembrete de documento + envio de DAS (dias 01/05/10/15).

-- E-mail do Cliente: destino do envio quando a forma de envio inclui e-mail. Opcional, como a
-- forma de envio e os contatos.
alter table public.clientes
  add column email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$'));

-- Alertas ao setor, lidos pelo painel do Funcionário. Um alerta aberto por Cliente e tipo: o job
-- roda quatro vezes por mês e renova o mesmo aviso até a condição acabar ou alguém resolvê-lo.
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

-- Abre o alerta ou, se já há um aberto do mesmo Cliente e tipo, renova mensagem e data: o setor
-- vê o problema mais recente, não o da primeira vez.
create function public.registrar_alerta_setor(
  p_setor public.setor_slug,
  p_tipo public.tipo_alerta_setor,
  p_cliente_id uuid,
  p_mensagem text
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem)
  on conflict (cliente_id, tipo) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

-- Ao fim da rodada: o que o job não renovou desde `p_desde` deixou de valer (o Cliente regularizou).
create function public.resolver_alertas_setor_nao_renovados(p_desde timestamptz)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.alertas_setor
     set resolvido_em = now()
   where resolvido_em is null and criado_em < p_desde;
$$;

-- Guias do DAS publicadas para o provedor de mensagem/e-mail buscar por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias-fiscais', 'guias-fiscais', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Clientes com Cadastro operacional do Simples Nacional, o contato padrão (telefone já com 55 e só
-- dígitos, como o webhook o recebe) e a última Mensagem do contato, que decide a janela de 24h.
create function public.clientes_para_lembrete()
returns table (
  cliente_id uuid,
  empresa text,
  email text,
  forma_envio public.forma_envio,
  documento_obrigatorio public.documento_obrigatorio_status,
  das_status public.das_status,
  data_envio_das date,
  contato_nome text,
  contato_telefone text,
  ultima_mensagem_do_contato_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.empresa, c.email, o.forma_envio, o.documento_obrigatorio, o.das_status,
         o.data_envio_das, ct.nome, ct.chave,
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

-- Reivindica o DAS: pronto → enviado com a data, só se ainda estiver pronto (quem reivindicou
-- entrega; quem não, não envia). Auditado com a URA como ator, porque o gatilho do cadastro não
-- audita sem sessão de usuário.
create function public.reivindicar_das_para_envio(p_cliente_id uuid, p_data date)
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

-- A entrega falhou: o DAS volta a pronto com a data de envio que tinha, e o desfazer fica na
-- auditoria ao lado da reivindicação.
create function public.desfazer_envio_das_automatico(p_cliente_id uuid, p_data_anterior date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cnpj text;
begin
  update public.cliente_cadastro_operacional_sn
     set das_status = 'pronto', data_envio_das = p_data_anterior, atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'enviado';
  if not found then
    return;
  end if;
  select cnpj into v_cnpj from public.clientes where id = p_cliente_id;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'simples_nacional',
    'cliente.desfazer-envio-das-automatico', v_cnpj, 'sucesso', now()
  );
end;
$$;

revoke all on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz),
  public.clientes_para_lembrete(),
  public.reivindicar_das_para_envio(uuid, date),
  public.desfazer_envio_das_automatico(uuid, date)
  from public, anon, authenticated;
grant execute on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz),
  public.clientes_para_lembrete(),
  public.reivindicar_das_para_envio(uuid, date),
  public.desfazer_envio_das_automatico(uuid, date)
  to service_role;

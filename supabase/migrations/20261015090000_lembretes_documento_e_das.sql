-- #52: job de lembrete de documento + envio de DAS (dias 01/05/10/15).

-- E-mail do Cliente: destino do envio quando a forma de envio inclui e-mail. Opcional, como a
-- forma de envio e os contatos.
alter table public.clientes
  add column email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$'));

-- O Admin informa o e-mail ao cadastrar o Cliente; a projeção que não-Admin lê também o expõe
-- (novas colunas entram no fim da view).
create or replace view public.clientes_basico
with (security_invoker = false) as
select id, empresa, cnpj, regime, email
from public.clientes
where public.pode_ver_cliente(id);

-- Mesma RPC do cadastro (20261002130000) com o e-mail. A assinatura antiga sai: duas versões
-- tornariam a chamada ambígua.
drop function if exists public.criar_cliente(uuid, text, text, public.regime, text, jsonb);
create function public.criar_cliente(
  p_id uuid,
  p_empresa text,
  p_cnpj text,
  p_regime public.regime,
  p_contrato_social_caminho text,
  p_alteracoes jsonb,
  p_email text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.clientes (id, empresa, cnpj, regime, contrato_social_caminho, email)
  values (p_id, p_empresa, p_cnpj, p_regime, p_contrato_social_caminho, p_email);

  insert into public.cliente_alteracoes_contratuais (id, cliente_id, data, arquivo_caminho)
  select
    (item ->> 'id')::uuid,
    p_id,
    (item ->> 'data')::date,
    item ->> 'arquivoCaminho'
  from jsonb_array_elements(p_alteracoes) as item;

  if p_regime in ('mei', 'simples_nacional') then
    insert into public.cliente_cadastro_operacional_sn
      (cliente_id, forma_envio, documento_obrigatorio, das_status, tem_parcelamento,
       parcelamento_status, observacoes_gerais)
    values
      (p_id, 'whatsapp', 'negativo', 'pendente', false, 'pendente', '');
  end if;
end;
$$;

-- Alertas ao setor, lidos pelo painel do Funcionário. Um alerta aberto por Cliente e tipo: o job
-- roda quatro vezes por mês e renova o mesmo aviso até a condição acabar ou alguém resolvê-lo.
-- 'entrega_parcial': a guia chegou por um canal só. Não é recorrente (o DAS já saiu de "pronto"),
-- então o job não a renova nem a resolve: fica aberta até alguém reenviar pelo outro canal.
create type public.tipo_alerta_setor as enum (
  'das_pendente', 'falha_envio', 'contato_ausente', 'entrega_parcial'
);

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
-- Só vale para os Clientes que a rodada avaliou (`p_cliente_ids`): a ausência de um alerta no que
-- o job leu não prova regularização de quem ele não leu. A entrega parcial fica de fora: ela só se
-- resolve com uma ação humana.
create function public.resolver_alertas_setor_nao_renovados(
  p_desde timestamptz,
  p_cliente_ids uuid[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.alertas_setor
     set resolvido_em = now()
   where resolvido_em is null and criado_em < p_desde and tipo <> 'entrega_parcial'
     and cliente_id = any (p_cliente_ids);
$$;

-- Guias do DAS publicadas para o provedor de mensagem/e-mail buscar por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias-fiscais', 'guias-fiscais', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Clientes com Cadastro operacional do Simples Nacional, o contato padrão e a última Mensagem do
-- contato, que decide a janela de 24h. Base interna, sem teto de linhas: as RPCs de leitura abaixo
-- paginam por cursor (cliente_id), porque o PostgREST corta a resposta em `max_rows`.
-- `contato_telefone` é o telefone de ENVIO (DDI 55 + DDD + número). A janela é consultada pela
-- chave NACIONAL (DDD + número), a mesma que o recebimento grava em `atendimentos.chave_telefone`
-- (`soDigitosNacionais`); as chaves históricas não são reescritas.
create function public.clientes_para_envio_base()
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
         o.data_envio_das, ct.nome, ct.telefone_envio,
         (select max(m.criado_em)
            from public.mensagens m
            join public.atendimentos a on a.id = m.atendimento_id
           where a.chave_telefone = ct.chave_nacional and m.autor = 'contato')
  from public.cliente_cadastro_operacional_sn o
  join public.clientes c on c.id = o.cliente_id
  left join lateral (
    select p.nome, n.chave_nacional,
           case when length(n.chave_nacional) in (10, 11)
                then '55' || n.chave_nacional else n.digitos end as telefone_envio
    from public.cliente_contatos p,
         lateral (select regexp_replace(p.telefone, '\D', '', 'g') as digitos) d,
         lateral (
           select d.digitos,
                  case when length(d.digitos) > 11 and left(d.digitos, 2) = '55'
                       then substr(d.digitos, 3) else d.digitos end as chave_nacional
         ) n
    where p.cliente_id = c.id and p.padrao
  ) ct on true;
$$;

-- Leitura do job de lembrete: uma página por chamada, em ordem de cliente_id. `p_apos` é o último
-- cliente_id da página anterior.
create function public.clientes_para_lembrete(p_apos uuid default null, p_limite int default 500)
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
  select b.*
    from public.clientes_para_envio_base() b
   where p_apos is null or b.cliente_id > p_apos
   order by b.cliente_id
   limit p_limite;
$$;

-- Auditoria da URA: o gatilho do cadastro não audita sem sessão de usuário, então a conclusão do
-- envio grava o evento aqui, com a URA como ator.
create function public.auditar_das_da_ura(p_cliente_id uuid, p_acao text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'simples_nacional',
         p_acao, cnpj, 'sucesso', now()
  from public.clientes where id = p_cliente_id;
$$;

-- Reserva do envio automático: a intenção de entregar a guia, separada do estado final do cadastro
-- (R87-01). O DAS/Parcelamento só vira `enviado` ao CONCLUIR, depois de a entrega ser aceita; queda
-- no meio deixa o cadastro como estava e a reserva expira (retomada na rodada seguinte). Uma linha
-- por Cliente e tipo: a tentativa vigente. `token` prova a posse: concluir/liberar com token antigo
-- não tem efeito.
create table public.envios_automaticos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo text not null check (tipo in ('das', 'parcelamento')),
  token uuid not null,
  reservado_em timestamptz not null default now(),
  concluido_em timestamptz,
  primary key (cliente_id, tipo)
);

-- Só o job (service_role) lê e escreve: RLS ligado e sem policy.
alter table public.envios_automaticos enable row level security;

-- Reserva a entrega: devolve o token da tentativa, ou null se o cadastro já não está elegível
-- (pronto/pendente) ou outra tentativa vigente (não expirada) já a reservou. O cadastro é travado
-- antes: a conclusão de outra tentativa termina antes de esta avaliar a elegibilidade.
create function public.reservar_envio_automatico(
  p_cliente_id uuid,
  p_tipo text,
  p_validade interval default interval '15 minutes'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_elegivel boolean;
  v_token uuid;
begin
  if p_tipo not in ('das', 'parcelamento') then
    raise exception 'tipo de envio automatico invalido: %', p_tipo;
  end if;

  select case p_tipo
           when 'das' then o.das_status = 'pronto'
           else o.tem_parcelamento and o.parcelamento_status = 'pendente'
         end
    into v_elegivel
    from public.cliente_cadastro_operacional_sn o
   where o.cliente_id = p_cliente_id
     for update;
  if not coalesce(v_elegivel, false) then
    return null;
  end if;

  insert into public.envios_automaticos as e (cliente_id, tipo, token)
  values (p_cliente_id, p_tipo, gen_random_uuid())
  on conflict (cliente_id, tipo) do update
     set token = gen_random_uuid(), reservado_em = now(), concluido_em = null
   where e.concluido_em is not null or e.reservado_em < now() - p_validade
  returning e.token into v_token;
  return v_token;
end;
$$;

-- A entrega falhou (resposta definida, sem aceite): libera a reserva para a próxima rodada. Token
-- antigo não libera a reserva de outra tentativa.
create function public.liberar_envio_automatico(p_cliente_id uuid, p_tipo text, p_token uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.envios_automaticos
   where cliente_id = p_cliente_id and tipo = p_tipo and token = p_token and concluido_em is null;
$$;

-- A entrega foi aceita: DAS pronto → enviado com a data, auditado com a URA como ator. Só com a
-- posse da reserva (token). `true` se o cadastro foi atualizado; `false` sem a posse ou se o
-- Funcionário já havia mexido no DAS (a reserva é concluída do mesmo jeito: não há o que repetir).
create function public.concluir_envio_automatico_das(
  p_cliente_id uuid,
  p_token uuid,
  p_data date
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'das' and token = p_token and concluido_em is null;
  if not found then
    return false;
  end if;

  update public.cliente_cadastro_operacional_sn
     set das_status = 'enviado', data_envio_das = p_data, atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'pronto';
  if not found then
    return false;
  end if;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-das-automatico');
  return true;
end;
$$;

revoke all on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz, uuid[]),
  public.clientes_para_envio_base(),
  public.clientes_para_lembrete(uuid, int),
  public.auditar_das_da_ura(uuid, text),
  public.reservar_envio_automatico(uuid, text, interval),
  public.liberar_envio_automatico(uuid, text, uuid),
  public.concluir_envio_automatico_das(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz, uuid[]),
  public.clientes_para_envio_base(),
  public.clientes_para_lembrete(uuid, int),
  public.auditar_das_da_ura(uuid, text),
  public.reservar_envio_automatico(uuid, text, interval),
  public.liberar_envio_automatico(uuid, text, uuid),
  public.concluir_envio_automatico_das(uuid, uuid, date)
  to service_role;

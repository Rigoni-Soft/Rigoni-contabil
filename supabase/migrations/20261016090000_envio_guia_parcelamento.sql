-- #53: job de envio da guia de parcelamento (dias 20/22/24/26/28).

-- O alerta ao setor passa a ter a origem (o job que o gerou): cada job renova e resolve só os
-- seus. Sem isso, a rodada do parcelamento fecharia o `das_pendente` do job de lembrete (que não
-- o renovou porque nem rodou) e vice-versa.
alter table public.alertas_setor
  add column origem text not null default 'lembretes' check (origem in ('lembretes', 'parcelamento'));

drop index public.alertas_setor_um_aberto_por_cliente_e_tipo;
create unique index alertas_setor_um_aberto_por_cliente_tipo_e_origem
  on public.alertas_setor (cliente_id, tipo, origem)
  where resolvido_em is null;

-- As RPCs do #52 ganham `p_origem`. As assinaturas antigas saem: duas versões tornariam a
-- chamada ambígua.
drop function public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text);
create function public.registrar_alerta_setor(
  p_setor public.setor_slug,
  p_tipo public.tipo_alerta_setor,
  p_cliente_id uuid,
  p_mensagem text,
  p_origem text default 'lembretes'
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem, origem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem, p_origem)
  on conflict (cliente_id, tipo, origem) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

drop function public.resolver_alertas_setor_nao_renovados(timestamptz);
create function public.resolver_alertas_setor_nao_renovados(
  p_desde timestamptz,
  p_origem text default 'lembretes'
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.alertas_setor
     set resolvido_em = now()
   where resolvido_em is null and criado_em < p_desde and tipo <> 'entrega_parcial'
     and origem = p_origem;
$$;

-- Clientes com Parcelamento pendente (e tem parcelamento positivo), com o contato padrão e a
-- janela de 24h: a mesma leitura do job de lembrete, filtrada.
create function public.clientes_para_parcelamento()
returns table (
  cliente_id uuid,
  empresa text,
  email text,
  forma_envio public.forma_envio,
  contato_nome text,
  contato_telefone text,
  ultima_mensagem_do_contato_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select l.cliente_id, l.empresa, l.email, l.forma_envio, l.contato_nome, l.contato_telefone,
         l.ultima_mensagem_do_contato_em
  from public.clientes_para_lembrete() l
  join public.cliente_cadastro_operacional_sn o on o.cliente_id = l.cliente_id
  where o.tem_parcelamento and o.parcelamento_status = 'pendente';
$$;

-- Reivindica o Parcelamento: pendente → enviado, só se ainda estiver pendente (quem reivindicou
-- entrega; quem não, não envia). Auditoria com a URA como ator, como no DAS.
create function public.reivindicar_parcelamento_para_envio(p_cliente_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.cliente_cadastro_operacional_sn
     set parcelamento_status = 'enviado', atualizado_em = now()
   where cliente_id = p_cliente_id and tem_parcelamento and parcelamento_status = 'pendente';
  if not found then
    return false;
  end if;
  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return true;
end;
$$;

-- A entrega falhou: o Parcelamento volta a pendente e o desfazer fica na auditoria ao lado da
-- reivindicação.
create function public.desfazer_envio_parcelamento_automatico(p_cliente_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.cliente_cadastro_operacional_sn
     set parcelamento_status = 'pendente', atualizado_em = now()
   where cliente_id = p_cliente_id and parcelamento_status = 'enviado';
  if found then
    perform public.auditar_das_da_ura(p_cliente_id, 'cliente.desfazer-envio-parcelamento-automatico');
  end if;
end;
$$;

revoke all on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz, text),
  public.clientes_para_parcelamento(),
  public.reivindicar_parcelamento_para_envio(uuid),
  public.desfazer_envio_parcelamento_automatico(uuid)
  from public, anon, authenticated;
grant execute on function
  public.registrar_alerta_setor(public.setor_slug, public.tipo_alerta_setor, uuid, text, text),
  public.resolver_alertas_setor_nao_renovados(timestamptz, text),
  public.clientes_para_parcelamento(),
  public.reivindicar_parcelamento_para_envio(uuid),
  public.desfazer_envio_parcelamento_automatico(uuid)
  to service_role;

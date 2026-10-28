-- Reserva da versão da guia PGFN durante a primeira entrega (revalidação da PR #195). O job e a URA
-- leem o PDF, publicam e só depois registram o envio; nessa janela uma troca ou remoção era aceita e a
-- guia atual divergia da entregue. Quem vai entregar reserva a versão lida (`arquivo_caminho`, único por
-- versão), com exclusividade e token de posse; a sessão de usuário não troca nem remove a guia
-- reservada, com erro explícito. O registro do envio passa a travar a competência como antes; falha na entrega libera a reserva.
--
-- A reserva vence sozinha (processo morto não prende a guia). Entrega que passe do prazo perde a
-- proteção: o registro do envio ainda aponta a versão entregue, nunca a atual.

ALTER TABLE public.cliente_parcelamento_guias ADD COLUMN em_envio_ate timestamp with time zone;
ALTER TABLE public.cliente_parcelamento_guias ADD COLUMN em_envio_token uuid;

-- Adquire a reserva só se ninguém a detém (ou se venceu) e devolve o token do dono; null = a guia
-- mudou desde a listagem ou outra tentativa a detém. Só o dono, com o token, libera.
CREATE FUNCTION public.reservar_guia_pgfn_para_envio(p_parcelamento_id uuid, p_competencia text, p_caminho text) RETURNS uuid
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.cliente_parcelamento_guias
     set em_envio_ate = now() + interval '15 minutes', em_envio_token = gen_random_uuid()
   where parcelamento_id = p_parcelamento_id and competencia = p_competencia
     and arquivo_caminho = p_caminho and estado = 'confirmada'
     and (em_envio_ate is null or em_envio_ate <= now())
  returning em_envio_token;
$$;

CREATE FUNCTION public.liberar_guia_pgfn_do_envio(p_parcelamento_id uuid, p_competencia text, p_token uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  update public.cliente_parcelamento_guias
     set em_envio_ate = null, em_envio_token = null
   where parcelamento_id = p_parcelamento_id and competencia = p_competencia
     and em_envio_token = p_token;
$$;

revoke all on function public.reservar_guia_pgfn_para_envio(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reservar_guia_pgfn_para_envio(uuid, text, text) to service_role;
revoke all on function public.liberar_guia_pgfn_do_envio(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.liberar_guia_pgfn_do_envio(uuid, text, uuid) to service_role;

-- Troca do PDF e remoção param na guia reservada. A coluna nova não entra no grant de UPDATE da sessão.
CREATE OR REPLACE FUNCTION public.proteger_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if exists (
    select 1 from public.cliente_parcelamento_envios e
     where e.parcelamento_id = coalesce(new.parcelamento_id, old.parcelamento_id)
       and e.parcela = coalesce(new.competencia, old.competencia)
  ) then
    raise exception 'Competência já enviada: não aceita guia nova nem alteração.' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    if old.em_envio_ate > now() then
      raise exception 'Guia em envio: tente novamente em instantes.' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.cliente_parcelamentos p where p.id = new.parcelamento_id and p.origem = 'pgfn'
    ) then
      raise exception 'Só Parcelamento da PGFN recebe guia anexada.' using errcode = '23514';
    end if;
    new.estado := 'a_confirmar';
    new.anexado_por := auth.uid();
    new.anexado_em := now();
    new.confirmado_por := null;
    new.confirmado_em := null;
    new.em_envio_ate := null;
    new.em_envio_token := null;
    return new;
  end if;

  new.em_envio_ate := old.em_envio_ate;
  new.em_envio_token := old.em_envio_token;

  -- Troca do PDF: a guia nova refaz a conferência, então volta a "a confirmar".
  if new.arquivo_caminho is distinct from old.arquivo_caminho then
    if old.em_envio_ate > now() then
      raise exception 'Guia em envio: tente novamente em instantes.' using errcode = '23514';
    end if;
    new.estado := 'a_confirmar';
    new.anexado_por := auth.uid();
    new.anexado_em := now();
    new.confirmado_por := null;
    new.confirmado_em := null;
    return new;
  end if;

  if new.conta_negociacao is distinct from old.conta_negociacao then
    raise exception 'A conta de negociação da guia só muda com a troca do PDF.' using errcode = '23514';
  end if;
  if old.estado = 'confirmada' or new.estado is distinct from 'confirmada' then
    raise exception 'A guia só muda de "a confirmar" para confirmada.' using errcode = '23514';
  end if;
  new.confirmado_por := auth.uid();
  new.confirmado_em := now();
  new.motivo := null;
  return new;
end;
$$;

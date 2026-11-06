-- Trocar, remover e visualizar a guia anexada da parcela PGFN (#184).
-- Troca (novo PDF) e remoção valem até o envio: competência com registro de envio trava as duas, como
-- já travava o anexo. A troca devolve a guia a "a confirmar" e renova quem anexou; só a troca mexe na
-- conta de negociação. Parcelamento PGFN cadastrado só ganha guias novas: código, origem, marca de
-- interno e parcelas restantes só mudam pelo sistema (sem auth.uid()), nunca pela sessão.

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
    return new;
  end if;

  -- Troca do PDF: a guia nova refaz a conferência, então volta a "a confirmar".
  if new.arquivo_caminho is distinct from old.arquivo_caminho then
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

-- Auditoria de sucesso na mesma transação: quem anexou, trocou, removeu ou confirmou e quando. A
-- remoção em cascata de um Parcelamento removido não tem alvo para auditar (a remoção dele já tem).
CREATE OR REPLACE FUNCTION public.auditar_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_parcelamento uuid;
  v_competencia text;
  v_acao text;
  v_alvo text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_parcelamento := old.parcelamento_id;
    v_competencia := old.competencia;
    v_acao := 'parcelamento.remover-guia';
  else
    v_parcelamento := new.parcelamento_id;
    v_competencia := new.competencia;
    if tg_op = 'INSERT' then
      v_acao := 'parcelamento.anexar-guia';
    elsif new.arquivo_caminho is distinct from old.arquivo_caminho then
      v_acao := 'parcelamento.trocar-guia';
    else
      v_acao := 'parcelamento.confirmar-guia';
    end if;
  end if;

  select c.cnpj || ' - ' || p.codigo || ' - ' || v_competencia into v_alvo
    from public.cliente_parcelamentos p join public.clientes c on c.id = p.cliente_id
   where p.id = v_parcelamento;
  if v_alvo is null then
    return null;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), public.meu_setor(), v_acao, v_alvo, 'sucesso', now());
  return null;
end;
$$;

DROP TRIGGER cliente_parcelamento_guias_proteger ON public.cliente_parcelamento_guias;
CREATE TRIGGER cliente_parcelamento_guias_proteger BEFORE INSERT OR UPDATE OR DELETE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_guia();

DROP TRIGGER cliente_parcelamento_guias_auditar ON public.cliente_parcelamento_guias;
CREATE TRIGGER cliente_parcelamento_guias_auditar AFTER INSERT OR UPDATE OR DELETE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_parcelamento_guia();

CREATE POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias FOR DELETE
  USING (exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = parcelamento_id and public.pode_editar_cadastro_operacional(p.cliente_id)
  ));

-- A sessão remove a guia e troca o PDF (com a conta e o motivo da nova leitura); competência e quem
-- anexou continuam fora do alcance dela (os gatilhos refazem o que é do banco).
grant delete on table public.cliente_parcelamento_guias to authenticated;
grant update (conta_negociacao, arquivo_caminho, motivo) on table public.cliente_parcelamento_guias to authenticated;

-- Parcelamento PGFN cadastrado: a sessão só ganha guias novas, não edita o acordo. Quem muda as
-- restantes é o sistema (envio da guia), sem auth.uid(), e a origem nunca muda por sessão.
CREATE FUNCTION public.proteger_cliente_parcelamento_pgfn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or old.origem is distinct from 'pgfn' then
    return new;
  end if;
  if new.codigo is distinct from old.codigo
     or new.origem is distinct from old.origem
     or new.interno is distinct from old.interno
     or new.parcelas_restantes is distinct from old.parcelas_restantes then
    raise exception 'Parcelamento da PGFN só ganha guias novas: código, origem, marca de interno e parcelas restantes não se editam.' using errcode = '23514';
  end if;
  return new;
end;
$$;

CREATE TRIGGER cliente_parcelamentos_proteger_pgfn BEFORE UPDATE ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_pgfn();

revoke all on function public.proteger_cliente_parcelamento_pgfn() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento_pgfn() to service_role;

-- Correções da revisão do PR #191.
-- F2: o PDF pertence ao Parcelamento. Na criação por sessão de usuário (RPC ou Data API) o caminho tem
-- de ser `<cliente_id>/<id>-<nome>` e nenhum outro Parcelamento pode apontar para o mesmo arquivo;
-- assim remover uma linha nunca apaga o PDF de outra.
-- F3: acordo da PGFN não entra no envio automático (a guia sairia pelo provedor errado) enquanto o
-- envio por acordo/origem não existe (#126, #172).

CREATE UNIQUE INDEX cliente_parcelamentos_arquivo_caminho_key ON public.cliente_parcelamentos (arquivo_caminho);

CREATE FUNCTION public.proteger_cliente_parcelamento_anexo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and new.arquivo_caminho not like new.cliente_id::text || '/' || new.id::text || '-%' then
    raise exception 'O anexo do Parcelamento não pertence a este registro.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_cliente_parcelamento_anexo() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento_anexo() to service_role;

CREATE TRIGGER cliente_parcelamentos_proteger_anexo BEFORE INSERT ON public.cliente_parcelamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_anexo();

CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
       and p.origem is distinct from 'pgfn'
       and not exists (
         select 1 from public.cliente_parcelamento_envios e
          where e.parcelamento_id = p.id
            and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'parcelamento' and token = p_token
     and concluido_em is null;
  if not found then
    return false;
  end if;

  if not public.cliente_tem_parcelamento_pendente(p_cliente_id) then
    return false;
  end if;

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela)
  select p.id, to_char(public.mes_corrente_sp(), 'YYYYMM')
    from public.cliente_parcelamentos p
   where p.cliente_id = p_cliente_id and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
     and p.origem is distinct from 'pgfn'
  on conflict (parcelamento_id, parcela) do nothing;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return true;
end;
$$;

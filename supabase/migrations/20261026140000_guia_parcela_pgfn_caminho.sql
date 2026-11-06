-- O PDF da guia pertence ao Parcelamento (#184): na sessão de usuário (RPC ou Data API) o caminho tem de
-- ser `<cliente_id>/guias-pgfn/<parcelamento_id>/...`. Sem isso a sessão apontaria a guia para o objeto
-- de outro Cliente, e o link temporário (assinado pelo servidor) ou a próxima troca/remoção (que apaga
-- pelo caminho gravado) agiria sobre ele. Sem auth.uid() (servidor confiável) nada muda.
CREATE FUNCTION public.proteger_cliente_parcelamento_guia_caminho() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.arquivo_caminho is not distinct from old.arquivo_caminho then
    return new;
  end if;
  if not exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = new.parcelamento_id
       and new.arquivo_caminho like p.cliente_id::text || '/guias-pgfn/' || p.id::text || '/%'
  ) then
    raise exception 'O PDF da guia não pertence a este Parcelamento.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_cliente_parcelamento_guia_caminho() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento_guia_caminho() to service_role;

CREATE TRIGGER cliente_parcelamento_guias_proteger_caminho BEFORE INSERT OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_guia_caminho();

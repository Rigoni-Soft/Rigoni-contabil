-- Data de alteração contratual não pode ser futura (#141, R170-03). A regra vale para toda via de
-- escrita (RPCs `criar_cliente`/`anexar_alteracao_contratual` e INSERT/UPDATE direto), no fuso de
-- negócio. Só barra escrita nova: linhas existentes não são tocadas. Sem exceção administrativa:
-- migração de dados históricos usa data real, nunca futura.
CREATE FUNCTION public.validar_data_alteracao_contratual() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'alteracao_contratual_data_futura' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

CREATE TRIGGER cliente_alteracoes_data_nao_futura BEFORE INSERT OR UPDATE OF data ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.validar_data_alteracao_contratual();

revoke all on function public.validar_data_alteracao_contratual() from public, anon, authenticated;

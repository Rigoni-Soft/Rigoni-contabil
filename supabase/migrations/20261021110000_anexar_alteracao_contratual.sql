-- Admin anexa uma alteração contratual a um Cliente existente (#141). A RPC é SECURITY INVOKER: o
-- INSERT passa pela policy `cliente_alteracoes_insert_admin`, então Líder e Funcionário são
-- recusados pelo banco. Nº repetido cai na UNIQUE (cliente_id, numero) e volta como 23505.
CREATE FUNCTION public.anexar_alteracao_contratual(p_cliente_id uuid, p_id uuid, p_numero integer, p_data date, p_caminho text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.cliente_alteracoes_contratuais (id, cliente_id, numero, data, arquivo_caminho)
  values (p_id, p_cliente_id, p_numero, p_data, p_caminho);
$$;

-- Auditoria de sucesso na mesma transação do INSERT; se o evento não puder ser gravado, a
-- alteração é desfeita. Ignora a escrita sem sessão e a criação do Cliente (já auditada como
-- `cliente.criar`: `auditar_cliente_criado` marca o Cliente na transação). Ator e setor vêm da
-- sessão do banco, nunca do chamador.
CREATE FUNCTION public.auditar_alteracao_contratual_anexada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or current_setting('app.cliente_auditado', true) = new.cliente_id::text then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.anexar-alteracao',
    (select cnpj from public.clientes where id = new.cliente_id) || ' - alteração nº ' || new.numero,
    'sucesso', now()
  );
  return null;
end;
$$;

CREATE TRIGGER cliente_alteracoes_auditar_anexo AFTER INSERT ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.auditar_alteracao_contratual_anexada();

revoke all on function public.anexar_alteracao_contratual(uuid, uuid, integer, date, text) from public, anon;
grant execute on function public.anexar_alteracao_contratual(uuid, uuid, integer, date, text) to authenticated, service_role;
revoke all on function public.auditar_alteracao_contratual_anexada() from public, anon, authenticated;
grant execute on function public.auditar_alteracao_contratual_anexada() to service_role;

-- Salva UM contato do Cliente (cria ou atualiza por id), sem tocar nos outros contatos: é o "Salvar"
-- da linha do formulário. A validação é a mesma do lote (`contato_gravar`).
CREATE FUNCTION public.salvar_contato_do_cliente(p_cliente_id uuid, p_contato jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if p_contato is null or jsonb_typeof(p_contato) <> 'object' then
    raise exception 'O contato deve ser um objeto.' using errcode = '22023';
  end if;
  return public.contato_gravar(p_cliente_id, p_contato);
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) TO authenticated, service_role;

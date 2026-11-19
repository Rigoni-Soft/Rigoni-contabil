-- Define UM Destino de envio do Setor de quem chama (ADR 0013): o Contato já cadastrado (`p_contato_id`)
-- ou um Contato novo (`p_contato`), criado na mesma transação pelo caminho único `contato_gravar`
-- (o Setor de quem cria vira o dono). O Setor vem do perfil, nunca do chamador; a permissão e o canal
-- válido são da RLS e do gatilho `destino_validar`. O Admin não tem Setor: não define Destinos.
CREATE FUNCTION public.salvar_destino_de_envio(
    p_cliente_id uuid, p_contato_id uuid, p_contato jsonb, p_tipo text, p_canal public.forma_envio
) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug := public.meu_setor();
  v_contato_id uuid := p_contato_id;
  v_id uuid;
begin
  if v_setor is null or public.meu_papel() = 'admin' then
    raise exception 'Só um Setor define os Destinos de envio do Cliente.' using errcode = '42501';
  end if;
  if (p_contato_id is null) = (p_contato is null) then
    raise exception 'Informe o contato já cadastrado ou os dados de um contato novo.' using errcode = '22023';
  end if;
  if p_contato is not null then
    if jsonb_typeof(p_contato) <> 'object' then
      raise exception 'O contato deve ser um objeto.' using errcode = '22023';
    end if;
    v_contato_id := public.contato_gravar(p_cliente_id, p_contato);
  end if;

  insert into public.destinos_de_envio (cliente_id, setor, tipo, contato_id, canal)
  values (p_cliente_id, v_setor, nullif(btrim(coalesce(p_tipo, '')), ''), v_contato_id, p_canal)
  returning id into v_id;
  return v_id;
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_destino_de_envio(uuid, uuid, jsonb, text, public.forma_envio) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_destino_de_envio(uuid, uuid, jsonb, text, public.forma_envio)
    TO authenticated, service_role;

-- Salva UM contato do Cliente (cria ou atualiza por id), sem tocar nos outros contatos: é o "Salvar"
-- da linha do formulário. As regras são as de `salvar_contatos_do_cliente` (dono, Admin, duplicidade).
CREATE FUNCTION public.salvar_contato_do_cliente(p_cliente_id uuid, p_contato jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid := coalesce(nullif(p_contato ->> 'id', '')::uuid, gen_random_uuid());
  v_nome text := btrim(coalesce(p_contato ->> 'nome', ''));
  v_telefone text := nullif(btrim(coalesce(p_contato ->> 'telefone', '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_contato ->> 'email', ''))), '');
  v_atual public.cliente_contatos;
  v_dono public.setor_slug := public.dono_do_novo_contato();
begin
  if p_contato is null or jsonb_typeof(p_contato) <> 'object' then
    raise exception 'O contato deve ser um objeto.' using errcode = '22023';
  end if;

  select * into v_atual from public.cliente_contatos where id = v_id;
  if found then
    if v_atual.cliente_id <> p_cliente_id then
      raise exception 'O contato pertence a outro Cliente.' using errcode = '42501';
    end if;
    if not public.pode_gerir_contato(p_cliente_id, v_atual.dono_setor) then
      raise exception 'Só o Setor dono do contato "%" ou o Admin pode editá-lo.', v_atual.nome
        using errcode = '42501';
    end if;
    update public.cliente_contatos
       set nome = v_nome, telefone = v_telefone, email = v_email
     where id = v_id;
  else
    if not public.pode_gerir_contato(p_cliente_id, v_dono) then
      raise exception 'Sem permissão para cadastrar contatos neste Cliente.' using errcode = '42501';
    end if;
    insert into public.cliente_contatos (id, cliente_id, nome, telefone, email, dono_setor)
    values (v_id, p_cliente_id, v_nome, v_telefone, v_email, v_dono);
  end if;
  return v_id;
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_contato_do_cliente(uuid, jsonb) TO authenticated, service_role;

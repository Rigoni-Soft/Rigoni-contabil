-- Define o que UM Contato recebe do Setor de quem chama (ADR 0013): a lista de tipos de envio do catálogo
-- do Setor, ou 'todos' (os "todos os envios do Setor", o tipo nulo do Destino). O canal vem do próprio
-- Contato: um canal só, esse; os dois, WhatsApp e e-mail. Tipos fora da lista saem, os novos entram e o
-- canal dos que ficam acompanha o Contato. O Setor vem do perfil, nunca do chamador; permissão e tipo
-- válido são da RLS e das chaves. O Admin não tem Setor: não define Destinos.
CREATE FUNCTION public.definir_tipos_de_envio_do_contato(p_cliente_id uuid, p_contato_id uuid, p_tipos text[])
    RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug := public.meu_setor();
  v_contato public.cliente_contatos;
  v_tem_whatsapp boolean;
  v_canal public.forma_envio;
  v_tipos text[];
begin
  if v_setor is null or public.meu_papel() = 'admin' then
    raise exception 'Só um Setor define os Destinos de envio do Cliente.' using errcode = '42501';
  end if;
  select * into v_contato from public.cliente_contatos
  where id = p_contato_id and cliente_id = p_cliente_id;
  if not found then
    raise exception 'O contato não pertence a este Cliente.' using errcode = '22023';
  end if;

  v_tem_whatsapp := public.chave_telefone(v_contato.telefone) is not null;
  v_canal := case
    when v_tem_whatsapp and v_contato.email is not null then 'whatsapp_e_email'
    when v_tem_whatsapp then 'whatsapp'
    else 'email'
  end;
  -- 'todos' é o tipo nulo do Destino.
  v_tipos := coalesce(p_tipos, '{}');

  delete from public.destinos_de_envio
  where cliente_id = p_cliente_id and setor = v_setor and contato_id = p_contato_id
    and coalesce(tipo, 'todos') <> all (v_tipos);

  update public.destinos_de_envio set canal = v_canal
  where cliente_id = p_cliente_id and setor = v_setor and contato_id = p_contato_id
    and canal is distinct from v_canal;

  insert into public.destinos_de_envio (cliente_id, setor, tipo, contato_id, canal)
  select p_cliente_id, v_setor, nullif(t, 'todos'), p_contato_id, v_canal
  from unnest(v_tipos) as t
  where not exists (
    select 1 from public.destinos_de_envio d
    where d.cliente_id = p_cliente_id and d.setor = v_setor and d.contato_id = p_contato_id
      and coalesce(d.tipo, 'todos') = t
  )
  group by t;
end;
$$;
REVOKE ALL ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[])
    TO authenticated, service_role;

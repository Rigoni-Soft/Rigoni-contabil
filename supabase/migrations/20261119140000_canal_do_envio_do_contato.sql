-- O contato com os dois canais (WhatsApp e e-mail) escolhe por qual canal o Setor lhe envia: a função
-- que define o que o Contato recebe passa a receber o canal. Com um canal só, o canal é o do Contato e o
-- p_canal é ignorado; com os dois, o p_canal é obrigatório e precisa caber no que o Contato tem.
DROP FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[]);

CREATE FUNCTION public.definir_tipos_de_envio_do_contato(
    p_cliente_id uuid,
    p_contato_id uuid,
    p_tipos text[],
    p_canal public.forma_envio DEFAULT NULL
)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug := public.meu_setor();
  v_contato public.cliente_contatos;
  v_tem_whatsapp boolean;
  v_tem_email boolean;
  v_canal public.forma_envio;
  v_tipos text[];
begin
  if v_setor is null or public.meu_papel() = 'admin' then
    raise exception 'Só um Setor define os Destinos de envio do Cliente.' using errcode = '42501';
  end if;
  -- A RLS já barra o insert; sem esta conferência, quem não gere o Cliente chamando com a lista vazia (ou igual à
  -- gravada) veria sucesso em delete/update que não afetam linha nenhuma.
  if not public.pode_gerir_parcelamento(p_cliente_id, v_setor) then
    raise exception 'Sem permissão para definir os Destinos de envio deste Cliente.' using errcode = '42501';
  end if;
  select * into v_contato from public.cliente_contatos
  where id = p_contato_id and cliente_id = p_cliente_id;
  if not found then
    raise exception 'O contato não pertence a este Cliente.' using errcode = '22023';
  end if;

  v_tem_whatsapp := public.chave_telefone(v_contato.telefone) is not null;
  v_tem_email := v_contato.email is not null;
  -- 'todos' é o tipo nulo do Destino.
  -- Elemento nulo na lista (chamada direta) faria o `<> all` virar nulo e nada sair: fica de fora.
  v_tipos := array(select distinct t from unnest(coalesce(p_tipos, '{}')) as t where t is not null);

  -- Com os dois canais qualquer canal escolhido cabe no contato; com um só, o p_canal é ignorado.
  if v_tem_whatsapp and v_tem_email then
    -- Sem tipo marcado não há envio, então não há canal a escolher (é o caso de deixar de usar o contato).
    if p_canal is null then
      if cardinality(v_tipos) > 0 then
        raise exception 'Escolha o canal do envio.' using errcode = '22023';
      end if;
      v_canal := 'whatsapp_e_email';
    else
      v_canal := p_canal;
    end if;
  elsif v_tem_whatsapp then
    v_canal := 'whatsapp';
  else
    v_canal := 'email';
  end if;

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
REVOKE ALL ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[], public.forma_envio)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_tipos_de_envio_do_contato(uuid, uuid, text[], public.forma_envio)
    TO authenticated, service_role;

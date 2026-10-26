-- Referência imutável do PDF entregue (devolutiva da #193). Publicar a guia no Storage não prova
-- entrega: só o envio aceito aponta o objeto, e o reenvio lê esse caminho em vez de inferir a
-- versão pela idade do arquivo ou pela ausência de recusados. Nada mais apaga o objeto publicado.
--
-- Registro anterior a esta migration fica com `caminho` nulo: o reenvio dele diz que a guia não está
-- guardada, em vez de adivinhar.

ALTER TABLE public.cliente_cadastro_operacional_sn ADD COLUMN caminho_guia_das text;
ALTER TABLE public.cliente_parcelamento_envios ADD COLUMN caminho text;

-- DAS: a conclusão do envio grava também o caminho do PDF entregue, na mesma transação do `enviado`.
DROP FUNCTION public.concluir_envio_automatico_das(uuid, uuid, date);

CREATE FUNCTION public.concluir_envio_automatico_das(p_cliente_id uuid, p_token uuid, p_data date, p_caminho text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'das' and token = p_token and concluido_em is null;
  if not found then
    return false;
  end if;

  update public.cliente_cadastro_operacional_sn
     set das_status = 'enviado', data_envio_das = p_data, caminho_guia_das = p_caminho,
         atualizado_em = now()
   where cliente_id = p_cliente_id and das_status = 'pronto';
  if not found then
    return false;
  end if;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-das-automatico');
  return true;
end;
$$;

revoke all on function public.concluir_envio_automatico_das(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.concluir_envio_automatico_das(uuid, uuid, date, text) to service_role;

-- Parcelamento: o registro da parcela guarda o caminho junto da identidade.
DROP FUNCTION public.registrar_envio_parcelamento(uuid, text, text);

CREATE FUNCTION public.registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text, p_caminho text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid;
begin
  select cliente_id into v_cliente_id
    from public.cliente_parcelamentos
   where id = p_parcelamento_id and situacao = 'em_aberto' and parcelas_restantes > 0
     for update;
  if not found then
    return 'nao_elegivel';
  end if;

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela, identidade, caminho)
  values (p_parcelamento_id, p_parcela, p_identidade, p_caminho)
  on conflict (parcelamento_id, parcela) do nothing;
  if not found then
    return 'ja_registrado';
  end if;

  update public.cliente_parcelamentos
     set parcelas_restantes = parcelas_restantes - 1,
         situacao = case when parcelas_restantes - 1 = 0 then 'quitado'::public.parcelamento_situacao else situacao end
   where id = p_parcelamento_id;

  perform public.auditar_das_da_ura(v_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return 'registrado';
end;
$$;

revoke all on function public.registrar_envio_parcelamento(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_parcelamento(uuid, text, text, text) to service_role;

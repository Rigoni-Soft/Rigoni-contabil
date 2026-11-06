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

-- O caminho é derivado da entrega, como `data_envio_das` (#108): sessão humana não o define nem o
-- apaga, nem por DML direto nem por upsert. No INSERT vai nulo (se já havia linha, o UPDATE do ON
-- CONFLICT o restaura aqui); no UPDATE preserva o atual. Sem sessão (job) nada muda.
CREATE OR REPLACE FUNCTION public.proteger_das_enviado_do_sistema() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atual public.das_status;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    v_atual := old.das_status;
  else
    select das_status into v_atual from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id;
  end if;

  if new.das_status = 'enviado' and v_atual is distinct from 'enviado' then
    raise exception 'O status DAS "enviado" é definido apenas pelo sistema.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.das_status = 'enviado' then
    new.data_envio_das := old.data_envio_das;
  else
    new.data_envio_das := null;
  end if;

  if tg_op = 'UPDATE' then
    new.caminho_guia_das := old.caminho_guia_das;
  else
    new.caminho_guia_das := null;
  end if;

  return new;
end;
$$;

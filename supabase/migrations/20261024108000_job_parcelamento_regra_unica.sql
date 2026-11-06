-- Job de parcelamento com regra única (#126). O envio é registrado por parcelamento e parcela
-- (AAAAMM), na entrega aceita de cada guia, em vez de um registro em lote ao fim da reserva do
-- Cliente. A reserva do Cliente continua exclusiva e só é fechada ao concluir.

-- Alertas novos do job de parcelamento: parcelamento pendente que ficou sem guia (código
-- desconhecido, valor que não casa, quitado no provedor) e, no ticket do financeiro, a falta do
-- contato do financeiro. Entram aqui para o job de agora e o seguinte usarem o mesmo enum.
ALTER TYPE public.tipo_alerta_setor ADD VALUE IF NOT EXISTS 'parcelamento_sem_guia';
ALTER TYPE public.tipo_alerta_setor ADD VALUE IF NOT EXISTS 'financeiro_ausente';

-- Identidade da guia entregue (`parcela:valor` enquanto o provedor não devolver o número do
-- documento): o job reconhece a reemissão de uma guia já entregue e não a passa a outro acordo.
ALTER TABLE public.cliente_parcelamento_envios ADD COLUMN identidade text;

-- Registro de envio de uma parcela: o banco manda, só um parcelamento em aberto com parcelas
-- restantes recebe. A mesma parcela entra uma vez só e só a primeira vez desconta uma parcela
-- restante (quita ao chegar a zero), auditada com a URA como ator. Devolve 'registrado',
-- 'ja_registrado' (a parcela já tinha registro; nada muda) ou 'nao_elegivel' (o parcelamento não
-- está mais em aberto: quitado, zerado ou removido; nada muda).
CREATE FUNCTION public.registrar_envio_parcelamento(p_parcelamento_id uuid, p_parcela text, p_identidade text) RETURNS text
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

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela, identidade)
  values (p_parcelamento_id, p_parcela, p_identidade)
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

-- Fecha só a reserva do Cliente (a tentativa vigente prova a posse pelo token); os registros de
-- envio já foram gravados guia a guia.
CREATE OR REPLACE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'parcelamento' and token = p_token
     and concluido_em is null;
  return found;
end;
$$;

revoke all on function public.registrar_envio_parcelamento(uuid, text, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_parcelamento(uuid, text, text) to service_role;

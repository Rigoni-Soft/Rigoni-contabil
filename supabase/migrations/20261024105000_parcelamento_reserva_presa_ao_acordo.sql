-- F3 do PR #191 (2ª revalidação): contar os candidatos de novo na conclusão não prova que o acordo
-- é o mesmo da reserva. Salvando o acordo B no lugar de A depois de reservar, a conclusão ainda via
-- "um candidato" (agora B) e registrava o envio da guia de A em B.
--
-- A reserva passa a guardar o acordo candidato (`parcelamento_id`) e a conclusão só grava nele, e só
-- se ele continuar sendo o candidato único. Acordo apagado (FK SET NULL), virado interno/PGFN ou
-- acompanhado de outro: a conclusão fecha a reserva sem registrar nada e a rodada seguinte reserva
-- o candidato de então. Provisório até o envio por acordo e competência (#126), que grava o
-- registro pelo ID do acordo entregue.

ALTER TABLE public.envios_automaticos
    ADD COLUMN parcelamento_id uuid REFERENCES public.cliente_parcelamentos(id) ON DELETE SET NULL;

-- O acordo que o job pode enviar agora: o único externo (não interno, não PGFN) em aberto e sem
-- registro de envio do mês. Null se não há ou há mais de um.
CREATE FUNCTION public.parcelamento_candidato_ao_envio(p_cliente_id uuid) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with candidatos as (
    select p.id from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
       and p.origem is distinct from 'pgfn'
  )
  select c.id from candidatos c
   where (select count(*) from candidatos) = 1
     and not exists (
       select 1 from public.cliente_parcelamento_envios e
        where e.parcelamento_id = c.id
          and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
     );
$$;
revoke all on function public.parcelamento_candidato_ao_envio(uuid) from public, anon, authenticated;
grant execute on function public.parcelamento_candidato_ao_envio(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select public.parcelamento_candidato_ao_envio(p_cliente_id) is not null;
$$;

CREATE OR REPLACE FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval DEFAULT '00:15:00'::interval) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_elegivel boolean;
  v_alvo uuid;
  v_token uuid;
begin
  if p_tipo not in ('das', 'parcelamento') then
    raise exception 'tipo de envio automatico invalido: %', p_tipo;
  end if;

  select case p_tipo
           when 'das' then o.das_status = 'pronto'
           else public.cliente_tem_parcelamento_pendente(p_cliente_id)
         end
    into v_elegivel
    from public.cliente_cadastro_operacional_sn o
   where o.cliente_id = p_cliente_id
     for update;
  if not coalesce(v_elegivel, false) then
    return null;
  end if;

  if p_tipo = 'parcelamento' then
    v_alvo := public.parcelamento_candidato_ao_envio(p_cliente_id);
  end if;

  insert into public.envios_automaticos as e (cliente_id, tipo, token, parcelamento_id)
  values (p_cliente_id, p_tipo, gen_random_uuid(), v_alvo)
  on conflict (cliente_id, tipo) do update
     set token = gen_random_uuid(), reservado_em = now(), concluido_em = null,
         parcelamento_id = excluded.parcelamento_id
   where e.concluido_em is not null or e.reservado_em < now() - p_validade
  returning e.token into v_token;
  return v_token;
end;
$$;

CREATE OR REPLACE FUNCTION public.concluir_envio_automatico_parcelamento(p_cliente_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_alvo uuid;
begin
  perform 1 from public.cliente_cadastro_operacional_sn where cliente_id = p_cliente_id for update;

  update public.envios_automaticos
     set concluido_em = now()
   where cliente_id = p_cliente_id and tipo = 'parcelamento' and token = p_token
     and concluido_em is null
  returning parcelamento_id into v_alvo;
  if not found then
    return false;
  end if;

  -- Trava o acordo reservado: uma edição concorrente dele espera esta transação.
  perform 1 from public.cliente_parcelamentos where id = v_alvo for update;
  if v_alvo is null or v_alvo is distinct from public.parcelamento_candidato_ao_envio(p_cliente_id) then
    return false;
  end if;

  insert into public.cliente_parcelamento_envios (parcelamento_id, parcela)
  values (v_alvo, to_char(public.mes_corrente_sp(), 'YYYYMM'))
  on conflict (parcelamento_id, parcela) do nothing;

  perform public.auditar_das_da_ura(p_cliente_id, 'cliente.enviar-parcelamento-automatico');
  return true;
end;
$$;

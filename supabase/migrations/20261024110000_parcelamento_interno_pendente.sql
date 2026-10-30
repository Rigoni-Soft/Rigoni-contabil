-- Parcelamento interno vai ao WhatsApp do financeiro (#127), e a regra única (#126) substitui a regra
-- provisória do F3 do PR #191.
--
-- As migrations 20261024100000 e 20261024105000 (F3 do PR #191) rodam antes de 20261024108000 (#126)
-- e recolocam a regra de um acordo candidato: só um acordo externo é elegível e a conclusão registra o
-- envio desse acordo. Com a regra única o registro é gravado pelo ID do acordo entregue
-- (`registrar_envio_parcelamento`), na entrega de cada guia, então esta migration restabelece o que o
-- #126 definiu e retira o provisório.

-- Pendente: Parcelamento em aberto, com parcelas restantes e sem registro de envio do mês corrente,
-- comum ou interno. A PGFN fica de fora: a guia dela é o PDF do escritório (#173), o job não a envia
-- nem a reserva. O interno conta porque o núcleo de envio decide o destino dele (o financeiro).
CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       and p.origem is distinct from 'pgfn'
       and not exists (
         select 1 from public.cliente_parcelamento_envios e
          where e.parcelamento_id = p.id
            and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
       )
  );
$$;

-- A reserva volta a ser só do Cliente e do tipo: não guarda mais o acordo.
CREATE OR REPLACE FUNCTION public.reservar_envio_automatico(p_cliente_id uuid, p_tipo text, p_validade interval DEFAULT '00:15:00'::interval) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_elegivel boolean;
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

  insert into public.envios_automaticos as e (cliente_id, tipo, token)
  values (p_cliente_id, p_tipo, gen_random_uuid())
  on conflict (cliente_id, tipo) do update
     set token = gen_random_uuid(), reservado_em = now(), concluido_em = null
   where e.concluido_em is not null or e.reservado_em < now() - p_validade
  returning e.token into v_token;
  return v_token;
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

-- Provisório do F3, sem uso depois do registro por ID do acordo.
DROP FUNCTION public.parcelamento_candidato_ao_envio(uuid);
ALTER TABLE public.envios_automaticos DROP COLUMN parcelamento_id;

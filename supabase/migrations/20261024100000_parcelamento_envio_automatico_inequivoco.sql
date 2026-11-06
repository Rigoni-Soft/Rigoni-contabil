-- F3 do PR #191: a guia do job vem por Cliente, sem dizer de qual acordo é. Com mais de um acordo
-- externo (não-PGFN) em aberto, entregar uma guia e marcar "enviado" seria adivinhar qual acordo
-- foi pago. Até o envio por acordo/competência (#126, #172), o job só age quando há exatamente um
-- acordo candidato: com dois ou mais, o Cliente sai do job (envio manual) e a conclusão não marca
-- nada. Vale para listar, reservar e concluir, que decidem por esta função.
CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select (
    select count(*) from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
       and p.origem is distinct from 'pgfn'
  ) = 1
  and exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0 and not p.interno
       and p.origem is distinct from 'pgfn'
       and not exists (
         select 1 from public.cliente_parcelamento_envios e
          where e.parcelamento_id = p.id
            and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
       )
  );
$$;

-- Parcelamento interno vai ao WhatsApp do financeiro (#127). O interno passa a contar como
-- pendente: o job reserva o Cliente que só tem interno em aberto, e o núcleo de envio decide o
-- destino (financeiro, nunca o Cliente). Cliente com Parcelamento em aberto sem registro de envio do
-- mês corrente é pendente, comum ou interno.
CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       and not exists (
         select 1 from public.cliente_parcelamento_envios e
          where e.parcelamento_id = p.id
            and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
       )
  );
$$;

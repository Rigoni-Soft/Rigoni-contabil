-- Envio da guia PGFN ao Cliente (#186). A guia confirmada à mão (#183) passa a ser entregue pelo job
-- de parcelamento (e pela URA) pelo mesmo caminho do provedor fiscal; o registro de envio e o
-- desconto de uma parcela restante continuam sendo de `registrar_envio_parcelamento`.
--
-- Pendente passa a ser também: Parcelamento PGFN em aberto, com parcelas restantes e guia confirmada,
-- de competência até o mês corrente (São Paulo), ainda sem registro de envio. Guia futura fica
-- guardada; sem guia confirmada o Cliente não é pendente (o lembrete da PGFN avisa o setor).
CREATE OR REPLACE FUNCTION public.cliente_tem_parcelamento_pendente(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_parcelamentos p
     where p.cliente_id = p_cliente_id
       and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       and (
         (p.origem is distinct from 'pgfn'
          and not exists (
            select 1 from public.cliente_parcelamento_envios e
             where e.parcelamento_id = p.id
               and e.parcela = to_char(public.mes_corrente_sp(), 'YYYYMM')
          ))
         or
         (p.origem = 'pgfn'
          and exists (
            select 1 from public.cliente_parcelamento_guias g
             where g.parcelamento_id = p.id
               and g.estado = 'confirmada'
               and g.competencia <= to_char(public.mes_corrente_sp(), 'YYYYMM')
               and not exists (
                 select 1 from public.cliente_parcelamento_envios e
                  where e.parcelamento_id = p.id and e.parcela = g.competencia
               )
          ))
       )
  );
$$;

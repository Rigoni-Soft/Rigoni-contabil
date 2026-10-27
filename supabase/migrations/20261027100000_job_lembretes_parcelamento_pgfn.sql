-- Job de lembretes PGFN: alerta do setor, um por Cliente, dos Parcelamentos PGFN em aberto
-- (inclusive interno) sem guia confirmada da competência do mês. Origem própria: o job renova e
-- resolve só os alertas dele, sem tocar nos do job de DAS/documento nem nos do de parcelamento.

ALTER TYPE public.tipo_alerta_setor ADD VALUE IF NOT EXISTS 'guia_pgfn_pendente';

ALTER TABLE public.alertas_setor DROP CONSTRAINT alertas_setor_origem_check;
ALTER TABLE public.alertas_setor
  ADD CONSTRAINT alertas_setor_origem_check CHECK (origem = ANY (ARRAY['lembretes'::text, 'parcelamento'::text, 'lembrete_pgfn'::text]));

-- Clientes que o job precisa reavaliar: com Parcelamento PGFN em aberto ou com alerta dele ainda
-- aberto (este, para o alerta se resolver quando a pendência acaba). `pendencias` lista os
-- Parcelamentos sem guia confirmada da competência do mês corrente (São Paulo): "a_confirmar" se há
-- guia anexada ainda não confirmada, "sem_guia" se não há nenhuma. Competência atrasada não conta.
-- Paginada por cursor (`p_apos`), como as demais leituras dos jobs.
CREATE FUNCTION public.clientes_com_parcelamento_pgfn(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, pendencias jsonb)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.id, c.empresa,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'codigo', p.codigo,
                    'estado', case when g.parcelamento_id is null then 'sem_guia' else 'a_confirmar' end
                  ) order by p.codigo)
             from public.cliente_parcelamentos p
             left join public.cliente_parcelamento_guias g
               on g.parcelamento_id = p.id
              and g.competencia = to_char(public.mes_corrente_sp(), 'YYYYMM')
            where p.cliente_id = c.id
              and p.origem = 'pgfn' and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
              and g.estado is distinct from 'confirmada'
         ), '[]'::jsonb)
    from public.clientes c
   where (p_apos is null or c.id > p_apos)
     and (
       exists (
         select 1 from public.cliente_parcelamentos p
          where p.cliente_id = c.id and p.origem = 'pgfn'
            and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
       )
       or exists (
         select 1 from public.alertas_setor a
          where a.cliente_id = c.id and a.origem = 'lembrete_pgfn' and a.resolvido_em is null
       )
     )
   order by c.id
   limit p_limite;
$$;

revoke all on function public.clientes_com_parcelamento_pgfn(uuid, integer) from public, anon, authenticated;
grant execute on function public.clientes_com_parcelamento_pgfn(uuid, integer) to service_role;

-- Holerite derivado dos cartões: por Cliente, quantos empregados ativos estão cadastrados, quantos estão
-- "sem movimento" no mês e quantos têm o Cartão de ponto do mês salvo. Cartão salvo = pelo menos um dia salvo
-- no mês (incompleto conta; cartão só iniciado, sem nenhum apontamento, não). Quem decide se o Holerite está concluído é o código; aqui só
-- se conta. A função roda como quem chama (SECURITY INVOKER): a RLS de empregados, dias e "sem movimento"
-- recorta por Cliente, então cada ator conta só o que já enxerga.
CREATE FUNCTION public.rh_cartoes_do_mes(p_competencia date)
RETURNS TABLE (cliente_id uuid, cadastrados integer, sem_movimento integer, cartoes integer)
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
  select e.cliente_id,
         count(*)::int,
         (count(*) filter (where sm.empregado_id is not null))::int,
         (count(*) filter (where sm.empregado_id is null and d.salvo))::int
  from public.rh_empregados e
  left join public.rh_empregado_sem_movimento sm
    on sm.empregado_id = e.id and sm.competencia = p_competencia
  cross join lateral (
    select exists (
      select 1 from public.rh_ponto_dias pd
      where pd.empregado_id = e.id
        and pd.data >= p_competencia
        and pd.data < (p_competencia + interval '1 month')::date
    ) as salvo
  ) d
  where e.ativo
  group by e.cliente_id;
$$;
REVOKE ALL ON FUNCTION public.rh_cartoes_do_mes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_cartoes_do_mes(date) TO authenticated, service_role;

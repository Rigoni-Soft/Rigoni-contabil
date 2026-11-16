-- Regra única de "cartão feito": ao menos um dia com apontamento (batida, Extra ou Abono) no mês. Antes bastava
-- existir uma linha em rh_ponto_dias; dia salvo sem apontamento deixa de contar. Mesma regra do código
-- (src/shared/kernel/situacao-do-cartao.ts). Só o critério da coluna `cartoes` muda; a assinatura, a RLS (SECURITY
-- INVOKER) e os grants seguem os da função original.
CREATE OR REPLACE FUNCTION public.rh_cartoes_do_mes(p_competencia date)
RETURNS TABLE (cliente_id uuid, cadastrados integer, sem_movimento integer, cartoes integer)
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
  select e.cliente_id,
         count(*)::int,
         (count(*) filter (where sm.empregado_id is not null))::int,
         (count(*) filter (where sm.empregado_id is null and d.feito))::int
  from public.rh_empregados e
  left join public.rh_empregado_sem_movimento sm
    on sm.empregado_id = e.id and sm.competencia = p_competencia
  cross join lateral (
    select exists (
      select 1 from public.rh_ponto_dias pd
      where pd.empregado_id = e.id
        and pd.data >= p_competencia
        and pd.data < (p_competencia + interval '1 month')::date
        and (jsonb_array_length(pd.batidas) > 0 or pd.extra is not null or pd.abono)
    ) as feito
  ) d
  where e.ativo
  group by e.cliente_id;
$$;

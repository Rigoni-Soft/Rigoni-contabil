-- Abono do atestado lido da foto: marca Abono em todos os dias numa transação só. Antes eram até 31 chamadas em
-- série e uma falha no meio deixava parte dos dias abonados sem o RH saber.
-- Só seta o Abono: batidas e Extra do dia ficam como estão (o atestado abona dia que já tem batida), e a marca
-- de cartão iniciado não é tocada (o atestado só abona em mês que o RH já iniciou, e pode cruzar dois meses).
-- Roda como quem chama (SECURITY INVOKER): a RLS de rh_ponto_dias, os gatilhos de proteção e a auditoria valem
-- como na gravação dia a dia. Qualquer dia recusado desfaz a função inteira. Só datas: nunca nome, CID ou documento.
CREATE FUNCTION public.rh_abonar_dias(p_empregado_id uuid, p_datas jsonb)
RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  v_data jsonb;
begin
  for v_data in select * from jsonb_array_elements(coalesce(p_datas, '[]'::jsonb)) loop
    insert into public.rh_ponto_dias (empregado_id, data, batidas, extra, abono)
    values (p_empregado_id, (v_data #>> '{}')::date, '[]'::jsonb, null, true)
    on conflict (empregado_id, data) do update set abono = true;
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.rh_abonar_dias(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_abonar_dias(uuid, jsonb) TO authenticated, service_role;

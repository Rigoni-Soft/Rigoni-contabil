-- Gravação do cartão lido da foto: marca o cartão do mês como iniciado e grava os dias da
-- quinzena numa transação só. Antes eram N chamadas em série e uma falha no meio deixava o cartão parcial.
-- Roda como quem chama (SECURITY INVOKER): a RLS de rh_cartoes_iniciados e de rh_ponto_dias, os gatilhos de
-- proteção e a auditoria valem como na gravação dia a dia. Qualquer dia recusado desfaz a função inteira.
-- Cada dia segue a regra do `salvarDia`: sem batida, sem Extra e sem Abono apaga a linha. Só a marca e os
-- dias: nunca imagem, nome lido, CID ou documento.
CREATE FUNCTION public.rh_gravar_cartao(p_empregado_id uuid, p_competencia date, p_dias jsonb)
RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  dia jsonb;
  v_batidas jsonb;
  v_extra jsonb;
  v_abono boolean;
begin
  if p_competencia <> date_trunc('month', p_competencia)::date then
    raise exception 'competencia deve ser o primeiro dia do mes';
  end if;

  insert into public.rh_cartoes_iniciados (empregado_id, competencia)
  values (p_empregado_id, p_competencia)
  on conflict do nothing;

  for dia in select * from jsonb_array_elements(coalesce(p_dias, '[]'::jsonb)) loop
    v_batidas := coalesce(dia -> 'batidas', '[]'::jsonb);
    v_extra := case when jsonb_typeof(dia -> 'extra') = 'object' then dia -> 'extra' else null end;
    v_abono := coalesce((dia ->> 'abono')::boolean, false);

    if jsonb_array_length(v_batidas) = 0 and v_extra is null and not v_abono then
      delete from public.rh_ponto_dias
      where empregado_id = p_empregado_id and data = (dia ->> 'data')::date;
    else
      insert into public.rh_ponto_dias (empregado_id, data, batidas, extra, abono)
      values (p_empregado_id, (dia ->> 'data')::date, v_batidas, v_extra, v_abono)
      on conflict (empregado_id, data)
      do update set batidas = excluded.batidas, extra = excluded.extra, abono = excluded.abono;
    end if;
  end loop;
end;
$$;
REVOKE ALL ON FUNCTION public.rh_gravar_cartao(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_gravar_cartao(uuid, date, jsonb) TO authenticated, service_role;

-- DAS `enviado` e `data_envio_das` são só do sistema (#108): quem grava é a conclusão do envio
-- (RPC de conclusão, ator URA). A edição manual não pode definir `enviado` nem alterar a data.
--
-- Mesma assinatura (grants/revokes da função continuam valendo); `p_data_envio_das` fica na
-- assinatura mas é ignorado — a data só muda quando o status sai de `enviado` (volta a null).
-- ponytail: parâmetro morto p_data_envio_das; remover quando a assinatura puder mudar junto com os grants.
CREATE OR REPLACE FUNCTION public.editar_cadastro_operacional_cliente(p_cliente_id uuid, p_forma_envio public.forma_envio, p_documento_obrigatorio public.documento_obrigatorio_status, p_das_status public.das_status, p_data_envio_das date, p_tem_parcelamento boolean, p_parcelamento_status public.parcelamento_status, p_observacoes_gerais text, p_contatos jsonb, p_ano_mes date, p_industria boolean, p_comercio boolean, p_servico boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_das_atual public.das_status;
begin
  -- sem primeiro acesso finalizado a barreira é a RLS (erro de permissão), não esta mensagem
  if public.acesso_liberado() and not public.regime_tem_cadastro_operacional_sn(p_cliente_id) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  if p_ano_mes is distinct from public.mes_corrente_sp() then
    raise exception 'Só a Atividade do mês corrente é editável.' using errcode = '23514';
  end if;

  select das_status into v_das_atual
  from public.cliente_cadastro_operacional_sn
  where cliente_id = p_cliente_id;

  -- `enviado` só se mantém (já era enviado pelo sistema); nunca nasce da edição manual
  if p_das_status = 'enviado' and v_das_atual is distinct from 'enviado' then
    raise exception 'O status DAS "enviado" é definido apenas pelo sistema.' using errcode = '23514';
  end if;

  insert into public.cliente_cadastro_operacional_sn
    (cliente_id, forma_envio, documento_obrigatorio, das_status, data_envio_das,
     tem_parcelamento, parcelamento_status, observacoes_gerais, atualizado_em)
  values
    (p_cliente_id, p_forma_envio, p_documento_obrigatorio, p_das_status, null,
     p_tem_parcelamento, p_parcelamento_status, p_observacoes_gerais, now())
  on conflict (cliente_id) do update set
    forma_envio = excluded.forma_envio,
    documento_obrigatorio = excluded.documento_obrigatorio,
    das_status = excluded.das_status,
    data_envio_das = case
      when excluded.das_status = 'enviado' then cliente_cadastro_operacional_sn.data_envio_das
      else null
    end,
    tem_parcelamento = excluded.tem_parcelamento,
    parcelamento_status = excluded.parcelamento_status,
    observacoes_gerais = excluded.observacoes_gerais,
    atualizado_em = now();

  -- Contatos: substituição total (delete-then-insert), não diff campo a
  -- campo — conjunto pequeno (padrão + poucos adicionais), sem exigência de
  -- histórico na spec.
  delete from public.cliente_contatos where cliente_id = p_cliente_id;
  insert into public.cliente_contatos (id, cliente_id, nome, telefone, padrao)
  select
    coalesce((item ->> 'id')::uuid, gen_random_uuid()),
    p_cliente_id,
    item ->> 'nome',
    item ->> 'telefone',
    (item ->> 'padrao')::boolean
  from jsonb_array_elements(p_contatos) as item;

  insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
  values (gen_random_uuid(), p_cliente_id, p_ano_mes, p_industria, p_comercio, p_servico)
  on conflict (cliente_id, ano_mes) do update set
    industria = excluded.industria,
    comercio = excluded.comercio,
    servico = excluded.servico;
end;
$$;

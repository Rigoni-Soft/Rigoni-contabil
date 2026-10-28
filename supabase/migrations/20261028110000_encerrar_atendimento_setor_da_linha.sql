-- Mesma correção de `assumir_atendimento` (#161): o Setor é lido antes do lock, e uma Transferência
-- no meio o muda. Antes, o filtro `setor = v_setor` fazia o encerramento devolver 'inexistente' num
-- Atendimento vivo. Agora, depois do `for update` (a Transferência também segura a linha), vale o
-- Setor da linha; se mudou, o lock desse Setor também é tomado antes de liberar o Funcionário pro
-- próximo da Fila, que exige o lock de quem chama.
CREATE OR REPLACE FUNCTION public.encerrar_atendimento(p_atendimento_id uuid, p_funcionario_id uuid, p_ator uuid, p_ator_setor public.setor_slug) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_atendimento public.atendimentos;
  v_proximo jsonb;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found or v_atendimento.funcionario_id is distinct from p_funcionario_id then
    return jsonb_build_object('status', 'inexistente');
  end if;
  if v_atendimento.setor <> v_setor then
    v_setor := v_atendimento.setor;
    perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));
  end if;

  update public.atendimentos set status = 'encerrado' where id = p_atendimento_id;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.encerrar',
    p_atendimento_id::text, 'sucesso'
  );

  if p_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_funcionario_id, v_setor);
  end if;
  return jsonb_build_object('status', 'encerrado', 'proximo', v_proximo);
end;
$$;

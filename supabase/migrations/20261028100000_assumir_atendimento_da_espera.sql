-- #161: assumir um Atendimento da espera do Setor. O primeiro clique vence: sob o lock do Setor e da
-- linha, quem chega depois encontra o dono e recebe 'ja_assumido'. Qualquer usuário ATIVO do Setor
-- assume (Admin, Líder, Funcionário), sem teto de simultâneos. Grava o evento imutável de assunção
-- (crédito do Balanceamento, que segue coexistindo) e a auditoria na mesma transação.
-- Devolve jsonb com `status`:
--  - 'inexistente': não existe ou já terminou;
--  - 'inelegivel': o ator está desativado, é de outro Setor, ou o Atendimento espera na fila pessoal
--    de outra pessoa (não é a espera do Setor);
--  - 'ja_assumido': já tem dono;
--  - 'assumido'.
CREATE FUNCTION public.assumir_atendimento(p_atendimento_id uuid, p_ator uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_setor public.setor_slug;
  v_atendimento public.atendimentos;
begin
  select setor into v_setor from public.atendimentos where id = p_atendimento_id;
  if v_setor is null then
    return jsonb_build_object('status', 'inexistente');
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento' and setor = v_setor
  for update;
  if not found then
    return jsonb_build_object('status', 'inexistente');
  end if;

  -- Elegibilidade antes do dono: quem não pode assumir não descobre se alguém já assumiu.
  if not public.atendente_elegivel(p_ator, v_setor)
     or (v_atendimento.fila_funcionario_id is not null
         and v_atendimento.fila_funcionario_id <> p_ator) then
    return jsonb_build_object('status', 'inelegivel');
  end if;
  if v_atendimento.funcionario_id is not null then
    return jsonb_build_object('status', 'ja_assumido');
  end if;

  update public.atendimentos
  set funcionario_id = p_ator, fila_funcionario_id = null, fila_desde = null, assumido_em = now()
  where id = p_atendimento_id;
  insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
  values (p_atendimento_id, p_ator);
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (gen_random_uuid(), p_ator, v_setor, 'atendimento.assumir', p_atendimento_id::text, 'sucesso');

  return jsonb_build_object('status', 'assumido');
end;
$$;

revoke all on function public.assumir_atendimento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assumir_atendimento(uuid, uuid) to service_role;

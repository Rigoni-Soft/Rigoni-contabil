-- #165: a espera fora da Recepção que nasceu sem destinatário (sem Responsável nem Líder) passa ao
-- destinatário assim que ele surge: Responsável atribuído (SN ou outro Setor), Líder ativado, criado ou
-- reativado. Mesmo cálculo da abertura (destinatario_da_espera); só toca a espera aberta, sem dono e sem
-- destinatário: não retira espera dirigida, não mexe em Atendimento assumido, não atribui dono e mantém
-- ID, mensagens e fila_desde. Usa o lock do Setor do assumir_atendimento, então a disputa segue atômica.
CREATE FUNCTION public.reconciliar_esperas_sem_destinatario(p_setor public.setor_slug, p_cliente_id uuid DEFAULT NULL) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_setor is null or p_setor = 'recepcao' then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  update public.atendimentos a
  set fila_funcionario_id = public.destinatario_da_espera(a.cliente_id, a.setor)
  where a.status = 'em_andamento'
    and a.setor = p_setor
    and a.funcionario_id is null
    and a.fila_funcionario_id is null
    and (p_cliente_id is null or a.cliente_id = p_cliente_id)
    and public.destinatario_da_espera(a.cliente_id, a.setor) is not null;
end;
$$;

revoke all on function public.reconciliar_esperas_sem_destinatario(public.setor_slug, uuid) from public, anon, authenticated;

CREATE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_table_name = 'cliente_responsaveis' then
    perform public.reconciliar_esperas_sem_destinatario(new.setor, new.cliente_id);
  elsif tg_table_name = 'cliente_cadastro_operacional_sn' then
    perform public.reconciliar_esperas_sem_destinatario('simples_nacional', new.cliente_id);
  else
    perform public.reconciliar_esperas_sem_destinatario(new.setor);
  end if;
  return null;
end;
$$;

revoke all on function public.reconciliar_esperas_ao_surgir_destinatario() from public, anon, authenticated;

CREATE TRIGGER cliente_responsaveis_reconciliar_esperas AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_responsaveis
    FOR EACH ROW WHEN (new.responsavel_id IS NOT NULL) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

CREATE TRIGGER cliente_cadastro_operacional_reconciliar_esperas AFTER INSERT OR UPDATE OF responsavel_id ON public.cliente_cadastro_operacional_sn
    FOR EACH ROW WHEN (new.responsavel_id IS NOT NULL) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

CREATE TRIGGER perfis_lider_reconciliar_esperas AFTER INSERT OR UPDATE OF papel, setor, desativado_em ON public.perfis
    FOR EACH ROW WHEN (new.papel = 'lider_setor' AND new.desativado_em IS NULL) EXECUTE FUNCTION public.reconciliar_esperas_ao_surgir_destinatario();

-- Devolutiva tecnica PR #61, ponto 3 (bloqueador herdado da PR #60): a PR #60
-- ja tinha fechado ator/criado_em (decididos pelo banco via auth.uid()/now()),
-- mas setor/acao/alvo/resultado continuavam aceitos do chamador sem nenhuma
-- correspondencia com uma operacao real -- qualquer usuario autenticado podia
-- chamar esta RPC direto (fora da UI, via supabase.rpc no browser) e fabricar
-- um evento de auditoria em seu proprio nome. Restringir EXECUTE a
-- `authenticated` nao bastaria: e exatamente quem nao deve poder inventar
-- eventos.
--
-- Fecha a fronteira de confianca no service_role (mesmo padrao ja usado pelo
-- SupabaseAuthAdminGateway, ADR 0001): so o servidor -- que ja validou a
-- sessao via ObterSessao antes de chamar RegistrarAcao -- escreve auditoria
-- agora. Como chamadas com service_role nao carregam um JWT de usuario,
-- auth.uid() deixa de existir nesse contexto; o ator passa a ser parametro
-- explicito, confiavel porque so o proprio servidor pode chamar esta funcao.
-- criado_em continua decidido pelo banco (now()), nao pelo chamador.
drop function public.registrar_acao_auditoria(
  uuid, public.setor_slug, text, text, public.resultado_acao
);

create function public.registrar_acao_auditoria(
  p_id uuid,
  p_ator uuid,
  p_setor public.setor_slug,
  p_acao text,
  p_alvo text,
  p_resultado public.resultado_acao
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ator is null then
    raise exception 'ator obrigatorio.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (p_id, p_ator, p_setor, p_acao, p_alvo, p_resultado, now());
end;
$$;

revoke execute on function public.registrar_acao_auditoria(
  uuid, uuid, public.setor_slug, text, text, public.resultado_acao
) from public, authenticated, anon;

grant execute on function public.registrar_acao_auditoria(
  uuid, uuid, public.setor_slug, text, text, public.resultado_acao
) to service_role;

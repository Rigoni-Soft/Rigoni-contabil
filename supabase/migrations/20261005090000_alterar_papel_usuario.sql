-- #57: Admin troca o papel de um usuario (Funcionario <-> Lider de setor).
-- Regra: cada Setor tem no maximo UM Lider ativo (nao desativado, #58). Garantida
-- no banco por indice unico parcial: fecha a corrida de duas promocoes simultaneas
-- que passariam na checagem do caso de uso.
create unique index perfis_um_lider_ativo_por_setor
  on public.perfis (setor)
  where papel = 'lider_setor' and desativado_em is null;

-- Troca + audita na MESMA transacao e e idempotente (ja no papel = nao faz nada,
-- sem auditoria duplicada). So service_role chama; "so Admin" e demais regras
-- ficam no caso de uso, unica porta de entrada. Conflito do indice vira uma
-- excecao com mensagem estavel (setor_com_lider) que o gateway traduz.
create function public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
begin
  if novo_papel = 'admin' then
    raise exception 'papel invalido.';
  end if;

  select * into v_alvo from public.perfis where id = alvo_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  if v_alvo.papel = 'admin' or v_alvo.desativado_em is not null then
    raise exception 'alvo nao pode mudar de papel.';
  end if;
  if v_alvo.papel = novo_papel then
    return;
  end if;

  select * into v_ator from public.perfis where id = ator_id;
  if not found then
    raise exception 'ator inexistente.';
  end if;

  begin
    update public.perfis set papel = novo_papel where id = alvo_id;
  exception when unique_violation then
    raise exception 'setor_com_lider';
  end;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), v_ator.id, v_alvo.setor,
    case when novo_papel = 'lider_setor' then 'usuario.promover' else 'usuario.rebaixar' end,
    v_alvo.email, 'sucesso', now()
  );
end;
$$;

revoke all on function public.alterar_papel_usuario(uuid, uuid, public.papel) from public, anon, authenticated;
grant execute on function public.alterar_papel_usuario(uuid, uuid, public.papel) to service_role;

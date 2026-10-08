-- #58: Admin desativa (soft delete) um Lider/Funcionario. O perfil continua
-- existindo (historico de auditoria preservado); o login e barrado no app
-- (Login/ObterSessao) e no Auth (ban, feito pelo caso de uso via service_role).
alter table public.perfis add column desativado_em timestamptz;

-- Marca + audita na MESMA transacao e e idempotente (ja desativado = nao faz
-- nada, sem auditoria duplicada), mesmo padrao de finalizar_troca_senha. So
-- service_role chama; "so Admin" e "so Lider/Funcionario" sao checados no caso
-- de uso, que e a unica porta de entrada.
create function public.desativar_usuario(alvo_id uuid, ator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
begin
  select * into v_alvo from public.perfis where id = alvo_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  if v_alvo.desativado_em is not null then
    return;
  end if;

  select * into v_ator from public.perfis where id = ator_id;
  if not found then
    raise exception 'ator inexistente.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), v_ator.id, v_alvo.setor, 'usuario.desativar', v_alvo.email, 'sucesso', now());

  update public.perfis set desativado_em = now() where id = alvo_id;
end;
$$;

revoke all on function public.desativar_usuario(uuid, uuid) from public, anon, authenticated;
grant execute on function public.desativar_usuario(uuid, uuid) to service_role;

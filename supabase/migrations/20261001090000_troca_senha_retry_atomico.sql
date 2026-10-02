-- Devolutiva tecnica PR #62 (retry): depois que updateUser() muda a senha no
-- Auth, uma falha na auditoria ou na finalizacao do perfil precisa ser
-- recuperavel SEM pedir nova troca de senha e SEM auditoria duplicada.
--
-- 1) senha_auth_alterada_em: prova de que updateUser() teve sucesso. Gravado
--    DEPOIS da troca no Auth (nunca antes, nunca por "tentativa iniciada"), via
--    registrar_auth_senha_alterada. Perfil em primeiro acesso + prova presente =
--    so falta perfil + auditoria, e o retry pula updateUser() por completo.
-- 2) finalizar_troca_senha: auditoria + senha_trocada_em na MESMA transacao e
--    idempotente (linha travada; se ja finalizada, nao faz nada) -- exatamente
--    1 evento de auditoria por troca, mesmo com N retries.
alter table public.perfis add column senha_auth_alterada_em timestamptz;

drop function if exists public.marcar_senha_trocada(uuid);

create function public.registrar_auth_senha_alterada(usuario_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfis
  set senha_auth_alterada_em = coalesce(senha_auth_alterada_em, now())
  where id = usuario_id and senha_trocada_em is null;
$$;

create function public.finalizar_troca_senha(usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
begin
  select * into v_perfil from public.perfis where id = usuario_id for update;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  if v_perfil.senha_trocada_em is not null then
    return;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), v_perfil.id, v_perfil.setor,
    'usuario.trocar_senha_primeiro_acesso', v_perfil.email, 'sucesso', now()
  );

  update public.perfis
  set senha_trocada_em = now(), senha_auth_alterada_em = null
  where id = v_perfil.id;
end;
$$;

revoke all on function public.registrar_auth_senha_alterada(uuid) from public, anon, authenticated;
revoke all on function public.finalizar_troca_senha(uuid) from public, anon, authenticated;
grant execute on function public.registrar_auth_senha_alterada(uuid) to service_role;
grant execute on function public.finalizar_troca_senha(uuid) to service_role;

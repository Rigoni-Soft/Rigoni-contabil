-- Devolutiva tecnica PR #62 (retry): depois que updateUser() muda a senha no
-- Auth, uma falha na auditoria ou na finalizacao do perfil precisa ser
-- recuperavel SEM pedir nova troca de senha e SEM auditoria duplicada.
--
-- 1) senha_troca_iniciada_em: marcador gravado ANTES de updateUser(). Perfil
--    ainda em primeiro acesso + marcador presente = "o Auth pode ja ter a senha
--    nova"; so nesse estado um `same_password` do Auth e tratado como retry
--    legitimo (sem o marcador, same_password = usuario reenviou a provisoria).
-- 2) finalizar_troca_senha: auditoria + senha_trocada_em na MESMA transacao e
--    idempotente (linha travada; se ja finalizada, nao faz nada) -- exatamente
--    1 evento de auditoria por troca, mesmo com N retries.
alter table public.perfis add column senha_troca_iniciada_em timestamptz;

drop function if exists public.marcar_senha_trocada(uuid);

create function public.iniciar_troca_senha(usuario_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfis
  set senha_troca_iniciada_em = coalesce(senha_troca_iniciada_em, now())
  where id = usuario_id and senha_trocada_em is null;
$$;

create function public.cancelar_troca_senha(usuario_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfis
  set senha_troca_iniciada_em = null
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
  set senha_trocada_em = now(), senha_troca_iniciada_em = null
  where id = v_perfil.id;
end;
$$;

revoke all on function public.iniciar_troca_senha(uuid) from public, anon, authenticated;
revoke all on function public.cancelar_troca_senha(uuid) from public, anon, authenticated;
revoke all on function public.finalizar_troca_senha(uuid) from public, anon, authenticated;
grant execute on function public.iniciar_troca_senha(uuid) to service_role;
grant execute on function public.cancelar_troca_senha(uuid) to service_role;
grant execute on function public.finalizar_troca_senha(uuid) to service_role;

-- #84: a Meta reentrega o webhook (qualquer status != 200 reenvia por até 7 dias), então a mesma
-- Mensagem do contato pode chegar duas vezes. Com o `wamid` guardado, o banco deduplica: uma
-- Mensagem por (Atendimento, id no provedor). Mensagens sem id (URA, Funcionário, anteriores ao
-- #84) ficam de fora do índice.
-- Repetidas já gravadas (dado de desenvolvimento): a mais antiga mantém o id, as outras perdem só
-- o id (a Mensagem continua na conversa).
update public.mensagens m set id_externo = null
where id_externo is not null and exists (
  select 1 from public.mensagens o
  where o.atendimento_id = m.atendimento_id and o.id_externo = m.id_externo
    and (o.criado_em, o.id) < (m.criado_em, m.id)
);

create unique index mensagens_atendimento_id_externo
  on public.mensagens (atendimento_id, id_externo)
  where id_externo is not null;

-- Mesma assinatura: reentrega do mesmo `p_id_externo` não insere de novo e continua `true`
-- (a Mensagem já está no Atendimento; a Meta pode confirmar com 200).
create or replace function public.anexar_mensagem_atendimento(
  p_chave text,
  p_autor public.autor_mensagem,
  p_texto text,
  p_id_externo text default null
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.atendimentos
  where chave_telefone = p_chave and status = 'em_andamento'
  order by criado_em desc
  limit 1;
  if v_id is null then
    return false;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  values (v_id, p_autor, p_texto, p_id_externo)
  on conflict (atendimento_id, id_externo) where id_externo is not null do nothing;
  return true;
end;
$$;

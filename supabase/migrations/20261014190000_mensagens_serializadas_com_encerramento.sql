-- Devolutiva da PR #85, R85-01: a Mensagem recebida (com mídia) e a do Funcionário (texto, anexo,
-- documento) faziam INSERT direto, sem reavaliar o status. Um fechamento confirmado entre a leitura
-- do Atendimento e o INSERT virava sucesso. Aqui as duas entram sob lock da linha do Atendimento
-- (`for update`), o mesmo protocolo de `anexar_mensagem_atendimento` e dos encerramentos.

-- Mensagem do contato (ou aviso do sistema, autor 'ura') num Atendimento identificado por id.
-- 'registrada' | 'duplicada' (mesmo id no provedor, reentrega em paralelo) | 'encerrada'
-- (inexistente ou já fechado: nada foi gravado, quem chamou descarta o que guardou).
create function public.registrar_mensagem_recebida(
  p_atendimento_id uuid,
  p_autor public.autor_mensagem,
  p_texto text,
  p_id_externo text default null,
  p_anexo jsonb default null
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status public.status_atendimento;
begin
  select status into v_status from public.atendimentos
  where id = p_atendimento_id
  for update;
  if v_status is distinct from 'em_andamento' then
    return 'encerrada';
  end if;

  insert into public.mensagens (
    atendimento_id, autor, texto, id_externo,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, p_autor, p_texto, p_id_externo,
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  on conflict (atendimento_id, id_externo) where id_externo is not null do nothing;
  if not found then
    return 'duplicada';
  end if;
  return 'registrada';
end;
$$;

-- Mensagem de um Funcionário (texto, anexo ou documento). Revalida a autoridade sob o lock: dono do
-- Atendimento, Líder do Setor onde ele está, ou Admin (a mesma regra de `podeTransferir`). Uma
-- transferência ou desativação entre a conferência e a gravação deixa de valer.
-- jsonb: { status: 'registrada', id } | { status: 'encerrada' } | { status: 'sem_autoridade' }.
create function public.registrar_mensagem_do_funcionario(
  p_atendimento_id uuid,
  p_ator uuid,
  p_ator_papel public.papel,
  p_ator_setor public.setor_slug,
  p_texto text,
  p_anexo jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_atendimento public.atendimentos;
  v_id uuid;
begin
  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id
  for update;
  if not found or v_atendimento.status <> 'em_andamento' then
    return jsonb_build_object('status', 'encerrada');
  end if;
  if not (
    p_ator_papel = 'admin'
    or (p_ator_papel = 'lider_setor' and p_ator_setor = v_atendimento.setor)
    or p_ator is not distinct from v_atendimento.funcionario_id
  ) then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  insert into public.mensagens (
    atendimento_id, autor, funcionario_id, texto,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, 'funcionario', p_ator, p_texto,
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  returning id into v_id;
  return jsonb_build_object('status', 'registrada', 'id', v_id);
end;
$$;

-- Compensação: a Mensagem foi gravada antes do envio (a intenção fica no histórico sob lock, sem
-- manter transação aberta durante o HTTP) e a entrega falhou. Só Mensagem de Funcionário.
create function public.desfazer_mensagem_do_funcionario(p_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.mensagens where id = p_id and autor = 'funcionario';
$$;

revoke all on function
  public.registrar_mensagem_recebida(uuid, public.autor_mensagem, text, text, jsonb),
  public.registrar_mensagem_do_funcionario(uuid, uuid, public.papel, public.setor_slug, text, jsonb),
  public.desfazer_mensagem_do_funcionario(uuid)
  from public, anon, authenticated;
grant execute on function
  public.registrar_mensagem_recebida(uuid, public.autor_mensagem, text, text, jsonb),
  public.registrar_mensagem_do_funcionario(uuid, uuid, public.papel, public.setor_slug, text, jsonb),
  public.desfazer_mensagem_do_funcionario(uuid)
  to service_role;

-- Mensagens recebidas e do Funcionário, anexos e estado de entrega.
-- Migration consolidada: reúne o estado final de várias migrations anteriores (o histórico
-- completo está no git). Funções aparecem uma vez, na última versão.

-- Fecha a intenção: true se saiu de `pendente`. Idempotente (reentrega de confirmação não muda nada).
CREATE FUNCTION public.finalizar_entrega_mensagem_do_funcionario(p_id uuid, p_entregue boolean) RETURNS boolean
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with finalizada as (
    update public.mensagens
    set entrega = case when p_entregue then 'entregue'::public.entrega_mensagem
                       else 'falha'::public.entrega_mensagem end
    where id = p_id and autor = 'funcionario' and entrega = 'pendente'
    returning 1
  )
  select exists (select 1 from finalizada);
$$;

-- A tentativa falhou e removeu o objeto: a reserva sai junto, o caminho volta a não existir.
CREATE FUNCTION public.liberar_anexo_em_envio(p_caminho text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  delete from public.anexos_em_envio where caminho = p_caminho;
$$;

CREATE FUNCTION public.pode_anexar_ao_atendimento(p_atendimento text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.atendimentos a
    join public.perfis p on p.id = auth.uid()
    where a.id::text = p_atendimento
      and a.status = 'em_andamento'
      and p.desativado_em is null
      and p.banido_em is null
      and (
        p.papel = 'admin'
        or (p.papel = 'lider_setor' and p.setor = a.setor)
        or a.funcionario_id = p.id
      )
  );
$$;

-- jsonb: { status: 'registrada', id } | { status: 'encerrada' } | { status: 'sem_autoridade' }.
CREATE FUNCTION public.registrar_mensagem_do_funcionario(p_atendimento_id uuid, p_ator uuid, p_texto text, p_anexo jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_perfil public.perfis;
  v_atendimento public.atendimentos;
  v_id uuid;
begin
  select * into v_perfil from public.perfis
  where id = p_ator and desativado_em is null and banido_em is null
  for share;
  if not found then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id
  for update;
  if not found or v_atendimento.status <> 'em_andamento' then
    return jsonb_build_object('status', 'encerrada');
  end if;
  -- Mesma regra de `podeTransferir`: dono, Líder do Setor onde o Atendimento está, ou Admin.
  if not (
    v_perfil.papel = 'admin'
    or (v_perfil.papel = 'lider_setor' and v_perfil.setor = v_atendimento.setor)
    or v_perfil.id is not distinct from v_atendimento.funcionario_id
  ) then
    return jsonb_build_object('status', 'sem_autoridade');
  end if;

  insert into public.mensagens (
    atendimento_id, autor, funcionario_id, texto, entrega,
    anexo_tipo, anexo_nome, anexo_caminho, anexo_tamanho, anexo_miniatura_caminho
  )
  values (
    p_atendimento_id, 'funcionario', p_ator, p_texto, 'pendente',
    p_anexo ->> 'tipo', p_anexo ->> 'nome', p_anexo ->> 'caminho',
    (p_anexo ->> 'tamanho')::integer, p_anexo ->> 'miniaturaCaminho'
  )
  returning id into v_id;
  return jsonb_build_object('status', 'registrada', 'id', v_id);
end;
$$;

-- Devolutiva da PR #85, R85-01: a Mensagem recebida (com mídia) e a do Funcionário (texto, anexo,
-- documento) faziam INSERT direto, sem reavaliar o status. Um fechamento confirmado entre a leitura
-- do Atendimento e o INSERT virava sucesso. Aqui as duas entram sob lock da linha do Atendimento
-- (`for update`), o mesmo protocolo de `anexar_mensagem_atendimento` e dos encerramentos.
-- Mensagem do contato (ou aviso do sistema, autor 'ura') num Atendimento identificado por id.
-- 'registrada' | 'duplicada' (mesmo id no provedor, reentrega em paralelo) | 'encerrada'
-- (inexistente ou já fechado: nada foi gravado, quem chamou descarta o que guardou).
CREATE FUNCTION public.registrar_mensagem_recebida(p_atendimento_id uuid, p_autor public.autor_mensagem, p_texto text, p_id_externo text DEFAULT NULL::text, p_anexo jsonb DEFAULT NULL::jsonb) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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

-- 'reservado': esta tentativa é dona do objeto. 'em_uso': outra finalização (em andamento ou
-- concluída) já o reservou, ou uma Mensagem do histórico já o referencia. Quem recebe 'em_uso'
-- recusa SEM remover o objeto: ele não é seu.
CREATE FUNCTION public.reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if exists (
    select 1 from public.mensagens
    where anexo_caminho = p_caminho or anexo_miniatura_caminho = p_caminho
  ) then
    return 'em_uso';
  end if;
  insert into public.anexos_em_envio (caminho, atendimento_id)
  values (p_caminho, p_atendimento_id)
  on conflict (caminho) do nothing;
  if not found then
    return 'em_uso';
  end if;
  return 'reservado';
end;
$$;

-- Quem pode executar/ler: só o service_role (jobs, webhook) onde há revoke.
revoke all on function public.finalizar_entrega_mensagem_do_funcionario(uuid, boolean) from public, anon, authenticated;
grant execute on function public.finalizar_entrega_mensagem_do_funcionario(uuid, boolean) to service_role;

revoke all on function public.liberar_anexo_em_envio(text) from public, anon, authenticated;
grant execute on function public.liberar_anexo_em_envio(text) to service_role;

revoke all on function public.pode_anexar_ao_atendimento(text) from public;
grant execute on function public.pode_anexar_ao_atendimento(text) to anon, authenticated, service_role;

revoke all on function public.registrar_mensagem_do_funcionario(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_mensagem_do_funcionario(uuid, uuid, text, jsonb) to service_role;

revoke all on function public.registrar_mensagem_recebida(uuid, public.autor_mensagem, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_mensagem_recebida(uuid, public.autor_mensagem, text, text, jsonb) to service_role;

revoke all on function public.reservar_anexo_para_envio(text, uuid) from public, anon, authenticated;
grant execute on function public.reservar_anexo_para_envio(text, uuid) to service_role;


-- Bucket privado dos anexos do Atendimento: o arquivo só sai por link temporário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-atendimento', 'anexos-atendimento', false, 10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'audio/ogg',
    'audio/mp4',
    'audio/webm'
  ]
)
on conflict (id) do nothing;

create policy anexos_atendimento_envio_do_funcionario
on storage.objects
for insert
to authenticated
with check (((bucket_id = 'anexos-atendimento') AND public.pode_anexar_ao_atendimento((storage.foldername(name))[1])));

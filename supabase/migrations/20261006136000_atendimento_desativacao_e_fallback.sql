-- Segunda devolutiva da PR #77 (revalidação).
--
-- 1) Escolha automática (fallback `p_atribuir_livre`) de abrir/transferir passa a revalidar o perfil
--    com lock (`atendente_elegivel`): uma desativação concorrente entre a consulta e a gravação não
--    leva o Atendimento a uma conta recém-desativada; sem elegível, ele espera na Fila.
-- 2) Desativar um usuário devolve os Atendimentos dele, com auditoria e sem apagar nada:
--    - Atendimento em andamento do desativado e Atendimento esperando na fila PESSOAL dele voltam à
--      Fila do Setor. A posição é a da criação do Atendimento (o cliente já esperava), ou a antiga
--      entrada na Fila, no caso da fila pessoal;
--    - se há Funcionário ativo livre no Setor, o mais antigo da Fila é atribuído a ele na mesma
--      transação (sem isso ficaria parado: a Fila só anda quando alguém se libera);
--    - Mensagens e o crédito mensal (assuncoes_atendimento, imutável) ficam como estão;
--    - um evento de auditoria por Atendimento. A desconexão temporária (#48) continua só mantendo
--      a atribuição: nada disso roda fora da desativação.

create or replace function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb,
  p_atribuir_livre boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_funcionario uuid := p_funcionario_id;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if v_funcionario is not null then
    if not public.atendente_elegivel(v_funcionario, p_setor) then
      return null;
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_funcionario and status = 'em_andamento'
    ) then
      return null;
    end if;
    v_promovido := public.assumir_proximo_da_fila(v_funcionario, p_setor);
    if v_promovido is not null then
      v_funcionario := null;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor and status = 'em_andamento' and funcionario_id is null
  ) then
    v_funcionario := public.funcionario_livre_do_setor(p_setor);
    -- Desativado entre a escolha e agora: revalida Setor e conta ativa COM lock (`for share`);
    -- inelegível não recebe, o Atendimento espera na Fila.
    if v_funcionario is not null
       and not public.atendente_elegivel(v_funcionario, p_setor) then
      v_funcionario := null;
    end if;
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde
  ) values (
    p_telefone, p_chave, p_cliente_id, p_setor, v_funcionario,
    case when v_funcionario is null then null else clock_timestamp() end,
    case when v_funcionario is null then clock_timestamp() else null end
  )
  returning id into v_id;
  if v_funcionario is not null then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (v_id, v_funcionario);
  end if;

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object(
    'id', v_id, 'funcionario_id', v_funcionario, 'promovido', v_promovido
  );
end;
$$;

create or replace function public.transferir_atendimento(
  p_atendimento_id uuid,
  p_origem_funcionario_id uuid,
  p_setor_destino public.setor_slug,
  p_funcionario_destino_id uuid,
  p_resumo text,
  p_ator uuid,
  p_ator_setor public.setor_slug,
  p_enfileirar_se_ocupado boolean,
  p_setor_origem public.setor_slug,
  p_atribuir_livre boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_atendimento public.atendimentos;
  v_contato_nome text;
  v_empresa text;
  v_cnpj text;
  v_na_fila boolean := false;
  v_destino uuid := p_funcionario_destino_id;
  v_proximo jsonb;
  v_promovido jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtext('atendimento:' || least(p_setor_destino::text, p_setor_origem::text)));
  if p_setor_origem <> p_setor_destino then
    perform pg_advisory_xact_lock(
      hashtext('atendimento:' || greatest(p_setor_destino::text, p_setor_origem::text)));
  end if;

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found
     or v_atendimento.funcionario_id is distinct from p_origem_funcionario_id
     or v_atendimento.setor is distinct from p_setor_origem then
    return jsonb_build_object('status', 'inexistente');
  end if;

  if v_destino is not null then
    if not public.atendente_elegivel(v_destino, p_setor_destino) then
      return jsonb_build_object('status', 'conflito');
    end if;
    if exists (
      select 1 from public.atendimentos
      where funcionario_id = v_destino and status = 'em_andamento'
        and id <> p_atendimento_id
    ) then
      if not p_enfileirar_se_ocupado then
        return jsonb_build_object('status', 'conflito');
      end if;
      v_na_fila := true;
    else
      v_promovido := public.assumir_proximo_da_fila(v_destino, p_setor_destino);
      if v_promovido is not null then
        if p_enfileirar_se_ocupado then
          v_na_fila := true;
        else
          v_destino := null;
        end if;
      end if;
    end if;
  elsif p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor_destino and status = 'em_andamento' and funcionario_id is null
  ) then
    v_destino := public.funcionario_livre_do_setor(p_setor_destino);
    -- Idem abrir: a escolha automática também é revalidada com lock até o fim da operação.
    if v_destino is not null
       and not public.atendente_elegivel(v_destino, p_setor_destino) then
      v_destino := null;
    end if;
  end if;

  -- Na fila de um usuário: sem dono ainda (funcionario_id e assumido_em nulos) e
  -- `fila_funcionario_id` aponta quem vai atender; fila do Setor = os dois nulos.
  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = case when v_na_fila then null else v_destino end,
      fila_funcionario_id = case when v_na_fila then v_destino else null end,
      assumido_em = case
        when v_na_fila or v_destino is null then null else clock_timestamp() end,
      fila_desde = case
        when v_na_fila or v_destino is null then clock_timestamp() else null end
  where id = p_atendimento_id;
  if v_destino is not null and not v_na_fila then
    insert into public.assuncoes_atendimento (atendimento_id, funcionario_id)
    values (p_atendimento_id, v_destino);
  end if;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, v_destino, btrim(p_resumo)
  );

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
  values (
    gen_random_uuid(), p_ator, p_ator_setor, 'atendimento.transferir',
    p_atendimento_id::text, 'sucesso'
  );

  if v_atendimento.cliente_id is not null then
    select c.empresa, c.cnpj into v_empresa, v_cnpj
    from public.clientes c where c.id = v_atendimento.cliente_id;
    select ct.nome into v_contato_nome
    from public.cliente_contatos ct
    where ct.cliente_id = v_atendimento.cliente_id
      and regexp_replace(ct.telefone, '\D', '', 'g') = v_atendimento.chave_telefone
    order by ct.padrao desc, ct.criado_em
    limit 1;
  end if;

  if p_origem_funcionario_id is not null then
    v_proximo := public.assumir_proximo_da_fila(p_origem_funcionario_id, p_setor_origem);
  end if;

  return jsonb_build_object(
    'status', 'transferido',
    'proximo_da_origem', v_proximo,
    'promovido', v_promovido,
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = v_destino),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;

-- Ordem de locks igual à de abrir/transferir (advisory do Setor, depois a linha do perfil): o
-- contrário deixaria a desativação e uma abertura concorrente se esperarem em ciclo.
create or replace function public.desativar_usuario(alvo_id uuid, ator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo public.perfis;
  v_ator public.perfis;
  v_setor public.setor_slug;
  v_livre uuid;
  v_assumido jsonb;
begin
  select setor into v_setor from public.perfis where id = alvo_id;
  if not found then
    raise exception 'perfil inexistente.';
  end if;
  perform pg_advisory_xact_lock(hashtext('atendimento:' || v_setor::text));

  select * into v_alvo from public.perfis where id = alvo_id for update;
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

  with removidos as (
    update public.cliente_cadastro_operacional_sn
    set responsavel_id = null
    where responsavel_id = alvo_id
    returning cliente_id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'cliente.remover-responsavel', c.cnpj, 'sucesso', now()
  from removidos r
  join public.clientes c on c.id = r.cliente_id;

  -- Os Atendimentos do desativado voltam à Fila do Setor. A marca vale só nesta transação: quem
  -- protege o dono do Atendimento (ex.: aviso de inatividade, #73) distingue a devolução da
  -- Transferência por ela.
  perform set_config('rigoni.devolucao_por_desativacao', 'on', true);
  with devolvidos as (
    update public.atendimentos a
    set funcionario_id = null,
        fila_funcionario_id = null,
        assumido_em = null,
        -- FIFO é a ordem de entrada na Fila, não a de abertura: quem estava sendo atendido entra
        -- agora (atrás de quem já esperava); quem esperava na fila pessoal do desativado mantém a
        -- espera. Os `a.*` do SET são os valores de antes da atualização.
        fila_desde = case
          when a.funcionario_id = alvo_id then clock_timestamp()
          else coalesce(a.fila_desde, a.criado_em)
        end
    where a.status = 'em_andamento'
      and (a.funcionario_id = alvo_id or a.fila_funcionario_id = alvo_id)
    returning a.id
  )
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), v_ator.id, v_alvo.setor, 'atendimento.devolver-fila', d.id::text, 'sucesso', now()
  from devolvidos d;
  perform set_config('rigoni.devolucao_por_desativacao', 'off', true);

  -- Funcionário ativo livre no Setor assume o mais antigo da Fila (o próprio desativado já não conta).
  loop
    v_livre := public.funcionario_livre_do_setor(v_alvo.setor);
    exit when v_livre is null;
    v_assumido := public.assumir_proximo_da_fila(v_livre, v_alvo.setor);
    exit when v_assumido is null;
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (gen_random_uuid(), v_ator.id, v_alvo.setor, 'atendimento.reatribuir',
            v_assumido ->> 'id', 'sucesso', now());
  end loop;
end;
$$;

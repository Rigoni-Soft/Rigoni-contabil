-- #45: transferência para o Simples Nacional vai direto ao Responsável do Cliente (ou ao Líder),
-- ignorando o Balanceamento; se o destino está ocupado o Atendimento entra na fila dele.
-- `fila_funcionario_id` guarda de quem é a fila (null = fila do Setor); quem consome é o #46.
alter table public.atendimentos add column fila_funcionario_id uuid references public.perfis (id);

drop function public.transferir_atendimento(
  uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug
);

-- Move o Atendimento para o Setor/Funcionário de destino, grava a Transferência e a auditoria de
-- sucesso numa transação só. O lock por Setor de destino é o mesmo de `abrir_atendimento`: as
-- atribuições do Setor se serializam. Devolve jsonb com `status`:
--  - 'inexistente': o Atendimento não está em andamento, ou o dono mudou desde a leitura;
--  - 'conflito': o Funcionário de destino foi ocupado por outro Atendimento (quem chama escolhe
--    de novo), salvo `p_enfileirar_se_ocupado` (destino fixo, ex.: Responsável do Cliente):
--    aí o Atendimento entra na fila dele (`na_fila` true);
--  - 'transferido': com os nomes e dados do Contato/Cliente para o destino.
-- `p_ator`/`p_ator_setor` vêm do chamador porque só o service_role executa a função (mesmo
-- contrato de `registrar_acao_auditoria`); ele já validou a sessão do ator.
-- ponytail: o Atendimento é uma linha só, então a contagem do Balanceamento mensal passa do
-- Funcionário de origem para o de destino; se a origem precisar manter o crédito, contar também
-- pela tabela `transferencias`.
create function public.transferir_atendimento(
  p_atendimento_id uuid,
  p_origem_funcionario_id uuid,
  p_setor_destino public.setor_slug,
  p_funcionario_destino_id uuid,
  p_resumo text,
  p_ator uuid,
  p_ator_setor public.setor_slug,
  p_enfileirar_se_ocupado boolean
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
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor_destino::text));

  select * into v_atendimento from public.atendimentos
  where id = p_atendimento_id and status = 'em_andamento'
  for update;
  if not found or v_atendimento.funcionario_id is distinct from p_origem_funcionario_id then
    return jsonb_build_object('status', 'inexistente');
  end if;

  if p_funcionario_destino_id is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = p_funcionario_destino_id and status = 'em_andamento'
  ) then
    if not p_enfileirar_se_ocupado then
      return jsonb_build_object('status', 'conflito');
    end if;
    v_na_fila := true;
  end if;

  -- Na fila de um usuário: sem dono ainda (funcionario_id e assumido_em nulos) e
  -- `fila_funcionario_id` aponta quem vai atender; fila do Setor = os dois nulos.
  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = case when v_na_fila then null else p_funcionario_destino_id end,
      fila_funcionario_id = case when v_na_fila then p_funcionario_destino_id else null end,
      assumido_em = case
        when v_na_fila or p_funcionario_destino_id is null then null else now() end
  where id = p_atendimento_id;

  insert into public.transferencias (
    atendimento_id, setor_origem, funcionario_origem_id,
    setor_destino, funcionario_destino_id, resumo
  ) values (
    p_atendimento_id, v_atendimento.setor, p_origem_funcionario_id,
    p_setor_destino, p_funcionario_destino_id, btrim(p_resumo)
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

  return jsonb_build_object(
    'status', 'transferido',
    'na_fila', v_na_fila,
    'destinatario_nome', (select nome from public.perfis where id = p_funcionario_destino_id),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;
revoke all on function public.transferir_atendimento(
  uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug, boolean
) from public, anon, authenticated;

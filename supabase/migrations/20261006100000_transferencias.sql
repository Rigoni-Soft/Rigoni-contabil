-- #45: Transferência de Atendimento em andamento para outro Setor.
-- Uma linha por Transferência guarda a origem e o resumo do assunto que o Funcionário de destino
-- recebe; o Atendimento em si só muda de Setor/Funcionário.
create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos (id) on delete cascade,
  setor_origem public.setor_slug not null,
  funcionario_origem_id uuid references public.perfis (id),
  setor_destino public.setor_slug not null,
  funcionario_destino_id uuid references public.perfis (id),
  resumo text not null check (length(btrim(resumo)) > 0),
  criado_em timestamptz not null default now()
);
create index transferencias_atendimento on public.transferencias (atendimento_id, criado_em);

-- RLS ligada e sem policy: só o service_role enxerga (telas de Funcionário entram depois).
alter table public.transferencias enable row level security;
revoke all on table public.transferencias from anon, authenticated;

-- Move o Atendimento para o Setor/Funcionário de destino, grava a Transferência e a auditoria de
-- sucesso numa transação só. O lock por Setor de destino é o mesmo de `abrir_atendimento`: as
-- atribuições do Setor se serializam. Devolve jsonb com `status`:
--  - 'inexistente': o Atendimento não está em andamento, ou o dono mudou desde a leitura;
--  - 'conflito': o Funcionário de destino foi ocupado por outro Atendimento (quem chama escolhe
--    de novo);
--  - 'transferido': com os nomes e dados do Contato/Cliente para o destino.
-- ponytail: o Atendimento é uma linha só, então a contagem do Balanceamento mensal passa do
-- Funcionário de origem para o de destino; se a origem precisar manter o crédito, contar também
-- pela tabela `transferencias`.
create or replace function public.transferir_atendimento(
  p_atendimento_id uuid,
  p_origem_funcionario_id uuid,
  p_setor_destino public.setor_slug,
  p_funcionario_destino_id uuid,
  p_resumo text,
  p_ator uuid,
  p_ator_setor public.setor_slug
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
    return jsonb_build_object('status', 'conflito');
  end if;

  update public.atendimentos
  set setor = p_setor_destino,
      funcionario_id = p_funcionario_destino_id,
      assumido_em = case when p_funcionario_destino_id is null then null else now() end
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
    'destinatario_nome', (select nome from public.perfis where id = p_funcionario_destino_id),
    'origem_nome', (select nome from public.perfis where id = p_origem_funcionario_id),
    'contato_nome', v_contato_nome,
    'empresa', v_empresa,
    'cnpj', v_cnpj
  );
end;
$$;
revoke all on function public.transferir_atendimento(
  uuid, uuid, public.setor_slug, uuid, text, uuid, public.setor_slug
) from public, anon, authenticated;

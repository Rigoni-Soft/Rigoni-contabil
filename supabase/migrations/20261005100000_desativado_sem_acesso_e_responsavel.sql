-- Devolutiva técnica PR #75. Migration nova (as de origem já estão mergeadas e não
-- se reescrevem): conta desativada perde o acesso no banco, Responsável é
-- desfeito na desativação e na promoção, e o bloqueio no Auth vira rastreável.

-- Ponto A: o ban do Auth não revoga um JWT já emitido (vale até expirar). O estado
-- "desativado" passa a ser requisito de autorização no banco. Toda policy de papel,
-- setor ou acesso liberado já passa por estes três helpers (meu_papel/meu_setor
-- inclusive nas policies de storage.objects), então uma troca cobre todas. O SELECT
-- do próprio perfil (`perfis_select_proprio`, id = auth.uid()) não passa por aqui e
-- segue liberado: a conta lê só a si mesma.
create or replace function public.meu_papel()
returns public.papel
language sql
security definer
stable
set search_path = public
as $$
  select papel from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

create or replace function public.meu_setor()
returns public.setor_slug
language sql
security definer
stable
set search_path = public
as $$
  select setor from public.perfis
  where id = auth.uid()
    and desativado_em is null
    and (senha_trocada_em is not null or senha_provisoria_expira_em > now());
$$;

create or replace function public.acesso_liberado()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and senha_trocada_em is not null and desativado_em is null
  );
$$;

-- Ponto D: "perfil desativado, ban pendente" fica rastreável. `banido_em` só é
-- preenchido depois que o Auth confirma o ban; desativado sem banido_em = pendência
-- que o Admin vê e reprocessa na tela de usuários.
alter table public.perfis add column banido_em timestamptz;

-- Ponto B: a desativação desfaz as atribuições de Responsável na MESMA transação
-- (Clientes ficam "Sem responsável", nada mais muda neles). Sem auth.uid() o trigger
-- de auditoria do Responsável não registra, então a remoção é auditada aqui, um
-- evento por Cliente, com o mesmo vocabulário de `cliente.remover-responsavel`.
create or replace function public.desativar_usuario(alvo_id uuid, ator_id uuid)
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
end;
$$;

-- Pontos B e C: o trigger de elegibilidade passa a exigir conta ativa e a travar a
-- linha do perfil (FOR SHARE). Atribuição concorrente com promoção/desativação (que
-- seguram FOR UPDATE no perfil) espera a outra transação e reavalia o papel/estado já
-- confirmados, em vez de gravar um vínculo inválido. SECURITY DEFINER porque travar
-- linha exige privilégio de UPDATE em `perfis`, que o Líder (quem atribui) não tem.
create or replace function public.proteger_responsavel_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.responsavel_id is null then
    return new;
  end if;

  if auth.uid() is not null
     and (public.meu_papel() is distinct from 'lider_setor'
          or public.meu_setor() is distinct from 'simples_nacional') then
    raise exception 'Só o Líder do Simples Nacional atribui o Responsável.' using errcode = '42501';
  end if;

  if new.responsavel_id is not null and not exists (
    select 1 from public.perfis
    where id = new.responsavel_id
      and papel = 'funcionario'
      and setor = 'simples_nacional'
      and desativado_em is null
    for share
  ) then
    raise exception 'O Responsável deve ser Funcionário ativo do Simples Nacional.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Ponto C: promover um Funcionário que ainda é Responsável é recusado, sem mutação
-- parcial: o Líder redistribui os Clientes antes. Nada é desvinculado em silêncio.
-- Mensagem estável (responsavel_com_clientes) que o gateway traduz.
create or replace function public.alterar_papel_usuario(alvo_id uuid, ator_id uuid, novo_papel public.papel)
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

  if exists (
    select 1 from public.cliente_cadastro_operacional_sn where responsavel_id = alvo_id
  ) then
    raise exception 'responsavel_com_clientes';
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

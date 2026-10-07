-- #46: o Atendimento aberto pela URA na recepção carrega o motivo e o CNPJ que o número informou.
-- `resumo_ura` é o que a recepção lê ao assumir (a origem é sempre a URA); `cnpj_informado` é o
-- CNPJ normalizado digitado por um número fora dos Contatos. Se o CNPJ é de um Cliente, o
-- Atendimento já nasce ligado a ele; sem Cliente é um provável cliente novo (cliente_id nulo e
-- cnpj_informado preenchido). Nenhum Contato é salvo (#43).
alter table public.atendimentos
  add column resumo_ura text check (length(btrim(resumo_ura)) between 1 and 1000),
  add column cnpj_informado text check (cnpj_informado ~ '^[0-9A-Z]{14}$');

drop function public.abrir_atendimento(
  text, text, uuid, public.setor_slug, uuid, jsonb, boolean
);
create function public.abrir_atendimento(
  p_telefone text,
  p_chave text,
  p_cliente_id uuid,
  p_setor public.setor_slug,
  p_funcionario_id uuid,
  p_mensagens jsonb,
  p_atribuir_livre boolean default false,
  p_resumo text default null,
  p_cnpj_informado text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_funcionario uuid := p_funcionario_id;
begin
  perform pg_advisory_xact_lock(hashtext('atendimento:' || p_setor::text));
  if v_funcionario is not null and exists (
    select 1 from public.atendimentos
    where funcionario_id = v_funcionario and status = 'em_andamento'
  ) then
    return null;
  end if;
  if v_funcionario is null and p_atribuir_livre and not exists (
    select 1 from public.atendimentos
    where setor = p_setor and status = 'em_andamento' and funcionario_id is null
  ) then
    v_funcionario := public.funcionario_livre_do_setor(p_setor);
  end if;

  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em, fila_desde,
    resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave,
    coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado)),
    p_setor, v_funcionario,
    case when v_funcionario is null then null else clock_timestamp() end,
    case when v_funcionario is null then clock_timestamp() else null end,
    p_resumo, p_cnpj_informado
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object('id', v_id, 'funcionario_id', v_funcionario);
end;
$$;
revoke all on function public.abrir_atendimento(
  text, text, uuid, public.setor_slug, uuid, jsonb, boolean, text, text
) from public, anon, authenticated;

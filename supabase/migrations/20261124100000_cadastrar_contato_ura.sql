-- A Recepção cadastra, no atendimento aberto pela URA, o número que a URA não achou como Contato do
-- Cliente confirmado (spec #283). A permissão é só esta: criar UM Contato do Cliente, com o WhatsApp do
-- atendimento, setor URA e a Recepção como dona. Não altera Contato nem Destino de outro Setor.
--
-- Quem chama: Funcionário ou Líder da Recepção que é o dono do atendimento em andamento (é quem
-- responde o cliente). O dono é conferido aqui e não nas políticas da tabela, porque a Recepção não
-- gerencia contatos em geral (`pode_gerir_contato`).
--
-- Devolve o resultado em vez de lançar erro quando o número já tem Contato, para a tela mostrar o existente:
--   criado | existente (o número já é Contato deste Cliente) | em_outro_cliente | email_em_uso
CREATE FUNCTION public.cadastrar_contato_ura(p_atendimento_id uuid, p_cliente_id uuid, p_nome text, p_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_atendimento public.atendimentos;
  v_cnpj text;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_chave text;
  v_existente public.cliente_contatos;
  v_id uuid := gen_random_uuid();
begin
  if not public.acesso_liberado() or public.meu_setor() is distinct from 'recepcao' then
    raise exception 'Só a Recepção cadastra contato pelo atendimento.' using errcode = '42501';
  end if;

  select * into v_atendimento from public.atendimentos where id = p_atendimento_id for update;
  if not found
     or v_atendimento.status <> 'em_andamento'
     or v_atendimento.setor <> 'recepcao'
     or v_atendimento.funcionario_id is distinct from auth.uid() then
    raise exception 'Você não pode cadastrar contato neste Atendimento.' using errcode = '42501';
  end if;

  select cnpj into v_cnpj from public.clientes where id = p_cliente_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  if v_nome = '' then
    raise exception 'O nome do contato é obrigatório.' using errcode = '22023';
  end if;
  v_chave := public.chave_telefone(v_atendimento.telefone);
  if v_chave is null then
    raise exception 'O atendimento não tem um WhatsApp válido.' using errcode = '22023';
  end if;

  -- O número já é Contato deste Cliente: mostra o existente, não duplica.
  select * into v_existente from public.cliente_contatos
   where cliente_id = p_cliente_id and public.chave_telefone(telefone) = v_chave;
  if found then
    return jsonb_build_object('status', 'existente', 'contato_id', v_existente.id, 'nome', v_existente.nome);
  end if;

  -- O número é Contato de outro Cliente: não cria (ficaria ambíguo para a URA).
  if exists (select 1 from public.cliente_contatos
              where cliente_id <> p_cliente_id and public.chave_telefone(telefone) = v_chave) then
    return jsonb_build_object('status', 'em_outro_cliente');
  end if;

  if v_email is not null then
    select * into v_existente from public.cliente_contatos
     where cliente_id = p_cliente_id and email = v_email;
    if found then
      return jsonb_build_object('status', 'email_em_uso', 'contato_id', v_existente.id, 'nome', v_existente.nome);
    end if;
  end if;

  -- A auditoria é desta ação (abaixo): o gatilho genérico de edição do cadastro não registra de novo.
  perform set_config('app.cliente_auditado', p_cliente_id::text, true);
  insert into public.cliente_contatos (id, cliente_id, nome, telefone, email, dono_setor)
  values (v_id, p_cliente_id, v_nome, v_chave, v_email, 'recepcao');

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), 'recepcao', 'contato.cadastrar-ura', v_cnpj, 'sucesso', now());

  return jsonb_build_object('status', 'criado', 'contato_id', v_id, 'nome', v_nome);
end;
$$;
REVOKE ALL ON FUNCTION public.cadastrar_contato_ura(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cadastrar_contato_ura(uuid, uuid, text, text) TO authenticated, service_role;

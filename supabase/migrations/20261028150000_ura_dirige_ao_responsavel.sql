-- #165: a regra de encaminhamento da URA a um Setor é a mesma da Transferência: o Atendimento nasce
-- dirigido ao Responsável do Cliente naquele Setor; sem Responsável ativo, ao Líder ativo do Setor;
-- sem Líder, na espera comum. A Recepção é a exceção: todos os Funcionários e o Líder respondem por
-- todo cliente que chega, então a espera dela é sempre comum. No Simples Nacional o Responsável fica
-- no cadastro operacional; nos demais Setores, em `cliente_responsaveis`.
CREATE FUNCTION public.destinatario_da_espera(p_cliente_id uuid, p_setor public.setor_slug) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select case when p_setor = 'recepcao' then null else coalesce(
    (select p.id
     from public.perfis p
     where p.id = case
         when p_setor = 'simples_nacional' then
           (select o.responsavel_id from public.cliente_cadastro_operacional_sn o where o.cliente_id = p_cliente_id)
         else
           (select r.responsavel_id from public.cliente_responsaveis r
            where r.cliente_id = p_cliente_id and r.setor = p_setor)
       end
       and p.papel = 'funcionario' and p.setor = p_setor and p.desativado_em is null),
    (select p.id from public.perfis p
     where p.setor = p_setor and p.papel = 'lider_setor' and p.desativado_em is null
     limit 1)
  ) end;
$$;

revoke all on function public.destinatario_da_espera(uuid, public.setor_slug) from public, anon, authenticated;
grant execute on function public.destinatario_da_espera(uuid, public.setor_slug) to service_role;

CREATE OR REPLACE FUNCTION public.abrir_atendimento(p_telefone text, p_chave text, p_cliente_id uuid, p_setor public.setor_slug, p_mensagens jsonb, p_resumo text DEFAULT NULL::text, p_cnpj_informado text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_cliente uuid := coalesce(p_cliente_id, (select id from public.clientes where cnpj = p_cnpj_informado));
begin
  insert into public.atendimentos (
    telefone, chave_telefone, cliente_id, setor, fila_desde, fila_funcionario_id, resumo_ura, cnpj_informado
  ) values (
    p_telefone, p_chave, v_cliente, p_setor, clock_timestamp(),
    public.destinatario_da_espera(v_cliente, p_setor), p_resumo, p_cnpj_informado
  )
  returning id into v_id;

  insert into public.mensagens (atendimento_id, autor, texto, id_externo)
  select v_id, (m ->> 'autor')::public.autor_mensagem, m ->> 'texto', m ->> 'idExterno'
  from jsonb_array_elements(p_mensagens) with ordinality as t(m, n)
  order by n;

  return jsonb_build_object('id', v_id);
end;
$$;

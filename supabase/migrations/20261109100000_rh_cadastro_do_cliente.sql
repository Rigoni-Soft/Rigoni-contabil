-- Cadastro do Cliente no RH: a mesma tela "Editar cadastro operacional" do SN, com os dados do RH. Contatos são
-- de todos os Setores (valem para qualquer Regime), as observações gerais são de cada Setor e o RH lê os
-- documentos contratuais como o SN. A edição do RH passa por uma função que só toca no que é do RH ou
-- compartilhado (contatos e observações do RH); o que é do SN (DAS, atividade, forma de envio) fica de fora.

-- Observações gerais por Setor: cada Setor lê e edita as suas; o Admin lê todas.
CREATE TABLE public.cliente_observacoes_setor (
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    setor public.setor_slug NOT NULL,
    observacoes text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliente_observacoes_setor_pkey PRIMARY KEY (cliente_id, setor)
);
ALTER TABLE public.cliente_observacoes_setor ENABLE ROW LEVEL SECURITY;

-- Escreve só a função abaixo (service_role e SECURITY DEFINER); a API lê pela RLS.
GRANT SELECT ON TABLE public.cliente_observacoes_setor TO authenticated;
GRANT ALL ON TABLE public.cliente_observacoes_setor TO service_role;

CREATE POLICY cliente_observacoes_setor_select ON public.cliente_observacoes_setor
    FOR SELECT TO authenticated
    USING (public.meu_papel() = 'admin'
           OR (public.pode_ver_cliente(cliente_id) AND public.meu_setor() = setor));

-- Os documentos contratuais são lidos pelo SN e agora pelo RH (só leitura; anexar segue sendo do Admin).
CREATE OR REPLACE FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Cliente nulo (objeto fora do padrão): pode_ver_cliente(null) é true para Líder, então barra aqui.
  select p_cliente_id is not null
    and public.pode_ver_cliente(p_cliente_id)
    and (public.meu_papel() = 'admin' or public.meu_setor() in ('simples_nacional', 'rh'));
$$;

-- A trava de Regime do cadastro operacional SN segue valendo para a escrita direta de contatos (Admin e SN);
-- só a função do RH, que liga `app.cadastro_rh` na própria transação, grava contatos de qualquer Regime.
CREATE OR REPLACE FUNCTION public.proteger_cadastro_operacional() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;
  -- coalesce: com a variável nunca definida current_setting devolve NULL, o IF vira NULL e a trava não dispara.
  if not (tg_table_name = 'cliente_contatos' and coalesce(current_setting('app.cadastro_rh', true), '') = 'on')
     and not exists (
    select 1 from public.clientes
    where id = v_cliente_id and regime in ('simples_nacional', 'mei')
  ) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  if tg_table_name = 'cliente_atividades_mensais' then
    if new.ano_mes <> public.mes_corrente_sp()
       or (tg_op = 'UPDATE' and old.ano_mes <> public.mes_corrente_sp()) then
      raise exception 'Só a Atividade do mês corrente é editável.' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- Edição do RH: observações do RH e, se vierem (p_contatos não nulo), os contatos, numa transação. Quem pode é quem gere o cadastro do Setor
-- (o Líder do RH, o Responsável do RH do Cliente e o Admin), a mesma regra dos Parcelamentos.
CREATE FUNCTION public.editar_cadastro_rh_cliente(p_cliente_id uuid, p_observacoes text, p_contatos jsonb DEFAULT NULL) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.pode_gerir_parcelamento(p_cliente_id, 'rh') then
    raise exception 'Sem permissão para editar o cadastro do RH.' using errcode = '42501';
  end if;
  if p_contatos is not null and jsonb_typeof(p_contatos) <> 'array' then
    raise exception 'Os contatos devem ser uma lista.' using errcode = '22023';
  end if;
  -- Vale só nesta transação: libera o gatilho de contatos para o Regime do Cliente.
  perform set_config('app.cadastro_rh', 'on', true);

  insert into public.cliente_observacoes_setor (cliente_id, setor, observacoes, atualizado_em)
  values (p_cliente_id, 'rh', coalesce(p_observacoes, ''), now())
  on conflict (cliente_id, setor) do update set
    observacoes = excluded.observacoes,
    atualizado_em = now();

  if p_contatos is not null then
    delete from public.cliente_contatos where cliente_id = p_cliente_id;
    insert into public.cliente_contatos (id, cliente_id, nome, telefone, padrao)
    select
      coalesce((item ->> 'id')::uuid, gen_random_uuid()),
      p_cliente_id,
      item ->> 'nome',
      item ->> 'telefone',
      (item ->> 'padrao')::boolean
    from jsonb_array_elements(p_contatos) as item;
  end if;

  perform set_config('app.cadastro_rh', 'off', true);

  -- Os contatos já geram a auditoria pelo gatilho; a edição só de observações também precisa de registro.
  if current_setting('app.cliente_auditado', true) is distinct from p_cliente_id::text then
    insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
    values (
      gen_random_uuid(), auth.uid(), public.meu_setor(), 'cliente.editar-operacional',
      (select cnpj from public.clientes where id = p_cliente_id), 'sucesso', now()
    );
  end if;
end;
$$;

REVOKE ALL ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_cadastro_rh_cliente(uuid, text, jsonb) TO authenticated, service_role;

-- Cartão de ponto "iniciado": o Funcionário do RH salvou o cartão do mês de um empregado, mesmo sem digitar nenhum
-- horário. Daí em diante os dias úteis sem batida são falta; antes disso o cartão é novo e os dias vazios ainda
-- não contam como falta. Só a marca (empregado + mês): nunca batida, motivo ou documento.
CREATE TABLE public.rh_cartoes_iniciados (
    empregado_id uuid NOT NULL REFERENCES public.rh_empregados(id) ON DELETE CASCADE,
    -- Primeiro dia do mês, como a competência do "sem movimento".
    competencia date NOT NULL,
    CONSTRAINT rh_cartoes_iniciados_pkey PRIMARY KEY (empregado_id, competencia),
    CONSTRAINT rh_cartoes_iniciados_mes_check CHECK (competencia = date_trunc('month', competencia)::date)
);

-- Mesma regra do cartão: só de empregado ativo.
CREATE TRIGGER rh_cartoes_iniciados_proteger BEFORE INSERT ON public.rh_cartoes_iniciados
    FOR EACH ROW EXECUTE FUNCTION public.proteger_ponto_rh();

-- A auditoria ganha a ação do novo registro ("rh.ponto.iniciar-cartao"); o resto da função é o da migration do
-- Cartão de ponto, sem mudança.
CREATE OR REPLACE FUNCTION public.auditar_rh_ponto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_acao text;
  v_alvo text;
  v_cliente uuid;
  v_nome text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'rh_ponto_padroes' then
    v_acao := 'rh.ponto.padrao-comissionados';
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = new.cliente_id), '?')
      || case when new.comissionados then ' sim' else ' nao' end;
  elsif tg_table_name = 'rh_empregados' then
    if tg_op = 'INSERT' then
      v_acao := 'rh.empregado.cadastrar';
    elsif new.ativo and not old.ativo then
      v_acao := 'rh.empregado.reativar';
    elsif not new.ativo and old.ativo then
      v_acao := 'rh.empregado.inativar';
    else
      v_acao := 'rh.empregado.corrigir';
    end if;
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = new.cliente_id), '?') || ' ' || new.nome;
  else
    select e.cliente_id, e.nome into v_cliente, v_nome
    from public.rh_empregados e
    where e.id = case when tg_op = 'DELETE' then old.empregado_id else new.empregado_id end;
    v_alvo := coalesce((select c.cnpj from public.clientes c where c.id = v_cliente), '?') || ' ' || coalesce(v_nome, '?');
    if tg_table_name = 'rh_ponto_dias' then
      v_acao := case when tg_op = 'DELETE' then 'rh.ponto.limpar' else 'rh.ponto.salvar' end;
      v_alvo := v_alvo || ' ' || to_char(case when tg_op = 'DELETE' then old.data else new.data end, 'YYYY-MM-DD');
    elsif tg_table_name = 'rh_cartoes_iniciados' then
      v_acao := 'rh.ponto.iniciar-cartao';
      v_alvo := v_alvo || ' ' || to_char(new.competencia, 'YYYY-MM');
    else
      v_acao := case when tg_op = 'DELETE' then 'rh.ponto.com-movimento' else 'rh.ponto.sem-movimento' end;
      v_alvo := v_alvo || ' ' || to_char(case when tg_op = 'DELETE' then old.competencia else new.competencia end, 'YYYY-MM');
    end if;
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (gen_random_uuid(), auth.uid(), public.meu_setor(), v_acao, v_alvo, 'sucesso', now());
  return null;
end;
$$;
CREATE TRIGGER rh_cartoes_iniciados_auditar AFTER INSERT ON public.rh_cartoes_iniciados
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_ponto();

ALTER TABLE public.rh_cartoes_iniciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_cartoes_iniciados_select ON public.rh_cartoes_iniciados FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_cartoes_iniciados_insert ON public.rh_cartoes_iniciados FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));

-- Grants explícitos: o anon não recebe nada; o authenticated só lê e marca (a marca não se desfaz).
REVOKE ALL ON TABLE public.rh_cartoes_iniciados FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rh_cartoes_iniciados TO authenticated;
GRANT ALL ON TABLE public.rh_cartoes_iniciados TO service_role;

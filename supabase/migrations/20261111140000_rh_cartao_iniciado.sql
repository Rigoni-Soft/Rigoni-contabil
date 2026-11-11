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

-- Auditoria do sucesso, na mesma transação (o ator é quem chama pela Data API). O alvo é o mesmo do resto do
-- cartão: CNPJ, nome do empregado e o mês. Função própria: a `auditar_rh_ponto` do cartão fica intocada.
CREATE FUNCTION public.auditar_rh_cartao_iniciado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  select gen_random_uuid(), auth.uid(), public.meu_setor(), 'rh.ponto.iniciar-cartao',
         coalesce(c.cnpj, '?') || ' ' || e.nome || ' ' || to_char(new.competencia, 'YYYY-MM'), 'sucesso', now()
  from public.rh_empregados e
  left join public.clientes c on c.id = e.cliente_id
  where e.id = new.empregado_id;
  return null;
end;
$$;
CREATE TRIGGER rh_cartoes_iniciados_auditar AFTER INSERT ON public.rh_cartoes_iniciados
    FOR EACH ROW EXECUTE FUNCTION public.auditar_rh_cartao_iniciado();

ALTER TABLE public.rh_cartoes_iniciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_cartoes_iniciados_select ON public.rh_cartoes_iniciados FOR SELECT USING (
    public.pode_ver_acompanhamento_rh(public.cliente_do_empregado_rh(empregado_id)));
CREATE POLICY rh_cartoes_iniciados_insert ON public.rh_cartoes_iniciados FOR INSERT WITH CHECK (
    public.sou_responsavel_rh_do_cliente(public.cliente_do_empregado_rh(empregado_id)));

-- Grants explícitos: o anon não recebe nada; o authenticated só lê e marca (a marca não se desfaz).
REVOKE ALL ON TABLE public.rh_cartoes_iniciados FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rh_cartoes_iniciados TO authenticated;
GRANT ALL ON TABLE public.rh_cartoes_iniciados TO service_role;
REVOKE ALL ON FUNCTION public.auditar_rh_cartao_iniciado() FROM PUBLIC, anon, authenticated;

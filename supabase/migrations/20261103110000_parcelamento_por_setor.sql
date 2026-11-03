-- Parcelamento por Setor: cada Setor tem os seus Parcelamentos (mesmo fluxo do SN) e só vê os seus; o
-- Admin vê todos. Quem busca a guia para enviar ao Cliente (URA, job) lê a união pelo servidor.
-- Os Parcelamentos que já existem passam a ser do Simples Nacional.
ALTER TABLE public.cliente_parcelamentos ADD COLUMN setor public.setor_slug NOT NULL DEFAULT 'simples_nacional';
ALTER TABLE public.cliente_parcelamentos ALTER COLUMN setor DROP DEFAULT;
CREATE INDEX cliente_parcelamentos_setor_idx ON public.cliente_parcelamentos USING btree (cliente_id, setor);

CREATE FUNCTION public.sou_responsavel_do_cliente_no_setor(p_cliente_id uuid, p_setor public.setor_slug) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cliente_responsaveis
    where cliente_id = p_cliente_id and setor = p_setor and responsavel_id = auth.uid()
  );
$$;

CREATE FUNCTION public.pode_gerir_parcelamento(p_cliente_id uuid, p_setor public.setor_slug) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.acesso_liberado() and coalesce(case public.meu_papel()
    when 'admin' then true
    when 'lider_setor' then public.meu_setor() = p_setor
    when 'funcionario' then
      public.meu_setor() = p_setor and public.sou_responsavel_do_cliente_no_setor(p_cliente_id, p_setor)
    else false
  end, false);
$$;

REVOKE ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) TO authenticated;
GRANT ALL ON FUNCTION public.sou_responsavel_do_cliente_no_setor(uuid, public.setor_slug) TO service_role;
REVOKE ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) TO authenticated;
GRANT ALL ON FUNCTION public.pode_gerir_parcelamento(uuid, public.setor_slug) TO service_role;

DROP POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos;
DROP POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos;
CREATE POLICY cliente_parcelamentos_select ON public.cliente_parcelamentos FOR SELECT USING (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_insert ON public.cliente_parcelamentos FOR INSERT WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_update ON public.cliente_parcelamentos FOR UPDATE USING (public.pode_gerir_parcelamento(cliente_id, setor)) WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY cliente_parcelamentos_delete ON public.cliente_parcelamentos FOR DELETE USING (public.pode_gerir_parcelamento(cliente_id, setor));

DROP POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias;
DROP POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias;
DROP POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias;
CREATE POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));
CREATE POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));
CREATE POLICY cliente_parcelamento_guias_delete ON public.cliente_parcelamento_guias FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.cliente_parcelamentos p
  WHERE ((p.id = cliente_parcelamento_guias.parcelamento_id) AND public.pode_gerir_parcelamento(p.cliente_id, p.setor)))));

DROP FUNCTION public.salvar_parcelamentos_cliente(uuid, jsonb);
CREATE FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_setor public.setor_slug, p_itens jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.cliente_parcelamentos
   where cliente_id = p_cliente_id and setor = p_setor
     and id not in (select (item ->> 'id')::uuid from jsonb_array_elements(p_itens) as item);

  -- UPDATE antes do INSERT: o gatilho BEFORE INSERT avaliaria a linha proposta de um Parcelamento
  -- quitado (parcelas em zero) antes de o ON CONFLICT resolvê-la.
  update public.cliente_parcelamentos p
     set codigo = item ->> 'codigo',
         parcelas_restantes = (item ->> 'parcelasRestantes')::integer,
         interno = (item ->> 'interno')::boolean
    from jsonb_array_elements(p_itens) as item
   where p.cliente_id = p_cliente_id and p.setor = p_setor and p.id = (item ->> 'id')::uuid;

  insert into public.cliente_parcelamentos (
    id, cliente_id, setor, codigo, parcelas_restantes, interno, arquivo_caminho,
    origem, total_parcelas, valor_parcela_centavos, data_adesao, criado_em
  )
  select (item ->> 'id')::uuid, p_cliente_id, p_setor, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho',
         item #>> '{acordo,origem}', (item #>> '{acordo,totalDeParcelas}')::integer,
         (item #>> '{acordo,valorDaParcelaCentavos}')::integer, (item #>> '{acordo,dataDeAdesao}')::date,
         now() + ordem * interval '1 microsecond'
    from jsonb_array_elements(p_itens) with ordinality as it(item, ordem)
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;
REVOKE ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.salvar_parcelamentos_cliente(uuid, public.setor_slug, jsonb) TO service_role;

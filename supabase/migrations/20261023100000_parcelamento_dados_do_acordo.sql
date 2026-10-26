-- Dados do acordo lidos do PDF do parcelamento, gravados com o Parcelamento na criação: órgão de
-- origem, total de parcelas, valor da parcela e data de adesão. São informativos (conferem o valor
-- da guia e dizem de onde veio o acordo), por isso nulos quando o PDF não traz ou o Parcelamento foi
-- digitado à mão. Só a criação os grava: `salvar_parcelamentos_cliente` não os toca no UPDATE.

ALTER TABLE public.cliente_parcelamentos
    ADD COLUMN origem text,
    ADD COLUMN total_parcelas integer,
    ADD COLUMN valor_parcela_centavos integer,
    ADD COLUMN data_adesao date,
    ADD CONSTRAINT cliente_parcelamentos_origem_check CHECK (origem IN ('receita_federal', 'pgfn')),
    ADD CONSTRAINT cliente_parcelamentos_total_parcelas_check CHECK (total_parcelas >= 1),
    ADD CONSTRAINT cliente_parcelamentos_valor_parcela_check CHECK (valor_parcela_centavos > 0);

CREATE OR REPLACE FUNCTION public.salvar_parcelamentos_cliente(p_cliente_id uuid, p_itens jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.cliente_parcelamentos
   where cliente_id = p_cliente_id
     and id not in (select (item ->> 'id')::uuid from jsonb_array_elements(p_itens) as item);

  -- UPDATE antes do INSERT: o gatilho BEFORE INSERT avaliaria a linha proposta de um Parcelamento
  -- quitado (parcelas em zero) antes de o ON CONFLICT resolvê-la.
  update public.cliente_parcelamentos p
     set codigo = item ->> 'codigo',
         parcelas_restantes = (item ->> 'parcelasRestantes')::integer,
         interno = (item ->> 'interno')::boolean
    from jsonb_array_elements(p_itens) as item
   where p.cliente_id = p_cliente_id and p.id = (item ->> 'id')::uuid;

  insert into public.cliente_parcelamentos (
    id, cliente_id, codigo, parcelas_restantes, interno, arquivo_caminho,
    origem, total_parcelas, valor_parcela_centavos, data_adesao
  )
  select (item ->> 'id')::uuid, p_cliente_id, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho',
         item #>> '{acordo,origem}', (item #>> '{acordo,totalDeParcelas}')::integer,
         (item #>> '{acordo,valorDaParcelaCentavos}')::integer, (item #>> '{acordo,dataDeAdesao}')::date
    from jsonb_array_elements(p_itens) as item
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;

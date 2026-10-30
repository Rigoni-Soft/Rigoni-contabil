-- Parcelamentos salvos juntos tinham o mesmo `criado_em` (now() é o da transação), e a listagem
-- (`criado_em`, `codigo`) desempatava pelo código: um código gerado como PARC-0EAA8154 passava
-- à frente de PARC-100 e a ordem digitada se perdia. O insert agora grava `criado_em` em sequência
-- (1 µs por item, na ordem do array), então a lista volta como o usuário a montou.
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
    origem, total_parcelas, valor_parcela_centavos, data_adesao, criado_em
  )
  select (item ->> 'id')::uuid, p_cliente_id, item ->> 'codigo', (item ->> 'parcelasRestantes')::integer,
         (item ->> 'interno')::boolean, item ->> 'arquivoCaminho',
         item #>> '{acordo,origem}', (item #>> '{acordo,totalDeParcelas}')::integer,
         (item #>> '{acordo,valorDaParcelaCentavos}')::integer, (item #>> '{acordo,dataDeAdesao}')::date,
         now() + ordem * interval '1 microsecond'
    from jsonb_array_elements(p_itens) with ordinality as it(item, ordem)
   where not exists (select 1 from public.cliente_parcelamentos p where p.id = (item ->> 'id')::uuid);
end;
$$;

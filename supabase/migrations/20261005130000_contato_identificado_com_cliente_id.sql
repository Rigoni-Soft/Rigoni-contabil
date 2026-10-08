-- #41: a entrega de documentos precisa saber de qual Cliente é o contato
-- identificado. `create or replace` não troca o tipo de retorno, por isso drop + create.
drop function public.identificar_contato_por_telefone(text);

create function public.identificar_contato_por_telefone(p_telefone text)
returns table (cliente_id uuid, nome text, empresa text, padrao boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, ct.nome, c.empresa, ct.padrao
  from public.cliente_contatos ct
  join public.clientes c on c.id = ct.cliente_id
  where regexp_replace(ct.telefone, '\D', '', 'g') = p_telefone
  -- Mesmo número em mais de um Cliente: o contato padrão vence, depois o mais antigo.
  order by ct.padrao desc, ct.criado_em
  limit 1;
$$;

revoke all on function public.identificar_contato_por_telefone(text) from public, anon, authenticated;
grant execute on function public.identificar_contato_por_telefone(text) to service_role;

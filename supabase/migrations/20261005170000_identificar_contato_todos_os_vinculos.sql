-- Mesmo telefone em mais de um Cliente (revisão do PR #76, B2): a função devolve todos os
-- vínculos, e quem chama decide. Antes um `limit 1` escolhia um Cliente em silêncio. Mesmo
-- tipo de retorno, então `create or replace` mantém os grants.
create or replace function public.identificar_contato_por_telefone(p_telefone text)
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
  order by ct.padrao desc, ct.criado_em;
$$;

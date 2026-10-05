-- #40: a URA (service_role, sem login humano) identifica quem escreveu pelo
-- número de WhatsApp. `cliente_contatos.telefone` guarda a máscara de exibição
-- "(11) 91234-5678", então a comparação é só pelos dígitos.
create function public.identificar_contato_por_telefone(p_telefone text)
returns table (nome text, empresa text, padrao boolean)
language sql
stable
security definer
set search_path = public
as $$
  select ct.nome, c.empresa, ct.padrao
  from public.cliente_contatos ct
  join public.clientes c on c.id = ct.cliente_id
  where regexp_replace(ct.telefone, '\D', '', 'g') = p_telefone
  -- Mesmo número em mais de um Cliente: o contato padrão vence, depois o mais antigo.
  order by ct.padrao desc, ct.criado_em
  limit 1;
$$;

revoke all on function public.identificar_contato_por_telefone(text) from public, anon, authenticated;
grant execute on function public.identificar_contato_por_telefone(text) to service_role;

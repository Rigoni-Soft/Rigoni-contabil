-- #162: o card da espera diz de onde o Atendimento veio (Setor e Funcionário que transferiu) e,
-- sem Transferência, mostra o resumo que a URA coletou.
drop function public.fila_do_setor(public.setor_slug);

CREATE FUNCTION public.fila_do_setor(p_setor public.setor_slug) RETURNS TABLE(id uuid, fila_funcionario_id uuid, fila_desde timestamp with time zone, telefone text, contato_nome text, empresa text, cnpj text, resumo text, origem_setor public.setor_slug, origem_nome text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    a.id, a.fila_funcionario_id, a.fila_desde, a.telefone,
    (select ct.nome from public.cliente_contatos ct
      where ct.cliente_id = a.cliente_id
        and regexp_replace(ct.telefone, '\D', '', 'g') = a.chave_telefone
      order by ct.padrao desc, ct.criado_em limit 1),
    c.empresa, c.cnpj,
    coalesce(t.resumo, a.resumo_ura),
    t.setor_origem,
    p.nome
  from public.atendimentos a
  left join public.clientes c on c.id = a.cliente_id
  left join lateral (
    select x.resumo, x.setor_origem, x.funcionario_origem_id
    from public.transferencias x
    where x.atendimento_id = a.id order by x.criado_em desc, x.id desc limit 1
  ) t on true
  left join public.perfis p on p.id = t.funcionario_origem_id
  where a.setor = p_setor and a.status = 'em_andamento' and a.funcionario_id is null
  order by a.fila_desde, a.id;
$$;

revoke all on function public.fila_do_setor(public.setor_slug) from public, anon, authenticated;
grant execute on function public.fila_do_setor(public.setor_slug) to service_role;

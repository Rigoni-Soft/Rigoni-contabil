-- Leitura do contrato social e das alterações por Líder do SN e Responsável (#140, sessão do
-- usuário, sem service_role). Regra única: pode_ver_cliente + Setor SN (pode_ver_cliente deixa
-- Líder/Funcionário de outros Setores verem o Cliente, mas o documento jurídico é do Setor SN).
-- Admin continua lendo tudo; anexar, trocar e apagar seguem só do Admin.
CREATE FUNCTION public.pode_ver_documentos_contratuais(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Cliente nulo (objeto fora do padrão): pode_ver_cliente(null) é true para Líder, então barra aqui.
  select p_cliente_id is not null
    and public.pode_ver_cliente(p_cliente_id)
    and (public.meu_papel() = 'admin' or public.meu_setor() = 'simples_nacional');
$$;

-- Contrato (tipo 'contrato', sem nº/data) e alterações (maior nº primeiro); vazio se o ator não pode
-- ver. Devolve o caminho só ao servidor: a tela nunca o recebe (o caso de uso o descarta).
CREATE FUNCTION public.documentos_contratuais_do_cliente(p_cliente_id uuid)
    RETURNS TABLE(tipo text, numero integer, data date, caminho text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select 'contrato', null::integer, null::date, c.contrato_social_caminho
    from public.clientes c
   where c.id = p_cliente_id
     and c.contrato_social_caminho is not null
     and public.pode_ver_documentos_contratuais(p_cliente_id)
  union all
  select 'alteracao', a.numero, a.data, a.arquivo_caminho
    from public.cliente_alteracoes_contratuais a
   where a.cliente_id = p_cliente_id
     and public.pode_ver_documentos_contratuais(p_cliente_id)
   order by 2 desc nulls last;
$$;

-- Objeto `{clienteId}/...`; fora desse padrão o cast seguro dá null e só a policy do Admin vale.
CREATE POLICY documentos_clientes_select_documento_contratual ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'documentos-clientes'
      and public.pode_ver_documentos_contratuais(
        case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then split_part(name, '/', 1)::uuid end)
    );

revoke all on function public.pode_ver_documentos_contratuais(uuid) from public, anon;
grant execute on function public.pode_ver_documentos_contratuais(uuid) to authenticated, service_role;
revoke all on function public.documentos_contratuais_do_cliente(uuid) from public, anon;
grant execute on function public.documentos_contratuais_do_cliente(uuid) to authenticated, service_role;

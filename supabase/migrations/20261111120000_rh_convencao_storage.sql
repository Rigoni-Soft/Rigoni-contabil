-- O PDF da convenção sobe com a sessão do usuário (sem service_role no caminho da requisição): policy de
-- INSERT só para quem sobe a convenção (Líder do RH e Admin). O arquivo de uma convenção gravada não sai
-- pelo usuário nem se remove. Só o arquivo ainda solto (nenhuma convenção o referencia) é visível e
-- removível, porque o Storage lê o objeto antes de apagá-lo: é a compensação de um envio que falhou depois
-- do upload. O INSERT só aceita o nome <cliente>/<id>.pdf (o do CHECK de rh_convencoes.arquivo_caminho): fora
-- dessa forma o objeto ficaria solto, sem convenção, e legível por qualquer gestor.

CREATE FUNCTION public.convencao_rh_usa_arquivo(p_caminho text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.rh_convencoes where arquivo_caminho = p_caminho);
$$;
REVOKE ALL ON FUNCTION public.convencao_rh_usa_arquivo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convencao_rh_usa_arquivo(text) TO authenticated, service_role;

CREATE POLICY convencoes_coletivas_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
                AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$');
CREATE POLICY convencoes_coletivas_select_sem_convencao ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
           AND NOT public.convencao_rh_usa_arquivo(name));
CREATE POLICY convencoes_coletivas_delete_sem_convencao ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'convencoes-coletivas' AND public.pode_gerir_convencao_rh()
           AND NOT public.convencao_rh_usa_arquivo(name));

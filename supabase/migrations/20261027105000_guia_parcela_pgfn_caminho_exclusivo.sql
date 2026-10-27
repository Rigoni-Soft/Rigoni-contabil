-- O PDF da guia é de uma só guia (F1 da revisão da PR #194): o caminho tem de ser da competência da
-- própria linha (`<cliente_id>/guias-pgfn/<parcelamento_id>/<competencia>-...`) e nenhum outro registro
-- pode apontar para o mesmo objeto. Sem isso, outra competência apontava para o PDF de uma guia já
-- enviada e a remoção dela apagava o objeto compartilhado. Vale na sessão de usuário (RPC ou Data API);
-- sem auth.uid() (servidor confiável) o gatilho nada muda, mas o índice único vale para todos.
-- Antes de aplicar numa base com dados: SELECT arquivo_caminho FROM cliente_parcelamento_guias GROUP BY 1
-- HAVING count(*) > 1 deve voltar vazio (o código sempre gravou `<competencia>-<uuid>.pdf`).
CREATE OR REPLACE FUNCTION public.proteger_cliente_parcelamento_guia_caminho() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.arquivo_caminho is not distinct from old.arquivo_caminho
     and new.competencia is not distinct from old.competencia then
    return new;
  end if;
  if not exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = new.parcelamento_id
       and new.arquivo_caminho like p.cliente_id::text || '/guias-pgfn/' || p.id::text || '/' || new.competencia || '-%'
  ) then
    raise exception 'O PDF da guia não pertence a este Parcelamento e competência.' using errcode = '23514';
  end if;
  return new;
end;
$$;

CREATE UNIQUE INDEX cliente_parcelamento_guias_arquivo_caminho_key
    ON public.cliente_parcelamento_guias (arquivo_caminho);

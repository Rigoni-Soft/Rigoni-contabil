
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares', 'avatares', false, 262144, '{image/webp}')
ON CONFLICT (id) DO UPDATE
    SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.perfis ADD COLUMN avatar_atualizado_em timestamp with time zone;

CREATE FUNCTION public.proteger_avatar_do_sistema() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.avatar_atualizado_em is not null)
     or (tg_op = 'UPDATE' and new.avatar_atualizado_em is distinct from old.avatar_atualizado_em) then
    raise exception 'A foto do avatar é gravada apenas pelo sistema.' using errcode = '23514';
  end if;

  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.proteger_avatar_do_sistema() FROM PUBLIC;

CREATE TRIGGER perfis_proteger_avatar BEFORE INSERT OR UPDATE ON public.perfis
    FOR EACH ROW EXECUTE FUNCTION public.proteger_avatar_do_sistema();

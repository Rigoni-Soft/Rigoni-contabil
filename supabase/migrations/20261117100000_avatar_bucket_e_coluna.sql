-- Foto do avatar do usuário (ADR 0012). O arquivo fica no bucket privado `avatares` (um objeto por usuário,
-- nome = `{usuario_id}`, só WebP, até 256 KB) e `perfis.avatar_atualizado_em` marca quando foi gravado
-- (nulo = sem foto). Quem grava os dois é só o servidor com service_role, depois de autorizar a ação.

-- Bucket privado. Nenhuma policy em storage.objects para `authenticated` ou `anon`: com o RLS ligado, a
-- ausência de policy nega leitura e escrita a qualquer sessão de usuário. A foto sai só pela rota do servidor.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares', 'avatares', false, 262144, '{image/webp}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.perfis ADD COLUMN avatar_atualizado_em timestamp with time zone;

-- Os grants de `perfis` são os da tabela (já explícitos no baseline: authenticated sem policy de UPDATE,
-- anon nada, service_role tudo); a coluna nova herda a leitura do dono pela policy de SELECT.
-- "Só o sistema grava" é travado no banco (ADR 0008): qualquer sessão com usuário, Admin inclusive, que
-- tente gravar a coluna (INSERT com valor, ou UPDATE que a mude) recebe erro 23514. Sem sessão
-- (`auth.uid()` nulo: service_role do servidor, seed, migration) a escrita passa.
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

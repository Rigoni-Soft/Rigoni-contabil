-- O RH encontra qualquer Cliente, de qualquer Regime, e lê só os dados básicos dele (a view
-- `clientes_basico`, sem contrato social). Contatos, cadastro operacional do SN e Parcelamentos de
-- outro Setor seguem pela regra de antes (`pode_ver_cliente`): o RH opera apenas os Clientes em que é
-- Responsável.
CREATE FUNCTION public.pode_ver_cliente_basico(p_cliente_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.pode_ver_cliente(p_cliente_id)
    or (public.acesso_liberado() and public.meu_setor() = 'rh');
$$;

REVOKE ALL ON FUNCTION public.pode_ver_cliente_basico(p_cliente_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pode_ver_cliente_basico(p_cliente_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pode_ver_cliente_basico(p_cliente_id uuid) TO service_role;

CREATE OR REPLACE VIEW public.clientes_basico WITH (security_invoker='false') AS
 SELECT id,
    empresa,
    cnpj,
    regime,
    email
   FROM public.clientes
  WHERE public.pode_ver_cliente_basico(id);

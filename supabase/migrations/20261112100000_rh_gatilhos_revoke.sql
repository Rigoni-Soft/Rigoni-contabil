-- Função de gatilho não é chamável por RPC; o REVOKE só alinha com o baseline e com auditar_rh_cartao_iniciado.
REVOKE ALL ON FUNCTION public.proteger_ponto_rh() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditar_rh_ponto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditar_rh_convencao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.proteger_convencao_do_empregado_rh() FROM PUBLIC, anon, authenticated;

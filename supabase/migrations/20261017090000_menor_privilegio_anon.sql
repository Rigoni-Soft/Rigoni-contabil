-- Menor privilégio para o papel `anon` (arquitetura.md, 3.12 e 3.14).
-- O sistema não tem acesso anônimo: o login usa a API de Auth, que não toca nas tabelas do
-- schema public. Até aqui o `anon` só era barrado pelo RLS (as policies eram `to public` e
-- dependiam de `auth.uid()` ser nulo); agora ele também não tem privilégio nenhum, e as
-- policies só valem para `authenticated`. O `service_role` ignora RLS e segue como está.

-- Tabelas e views: nada para anon; authenticated só lê/grava (o RLS filtra), sem TRUNCATE
-- (que o RLS não cobre), REFERENCES nem TRIGGER.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Policies: só `authenticated`.
alter policy "cliente_alteracoes_insert_admin" on public.cliente_alteracoes_contratuais to authenticated;
alter policy "cliente_alteracoes_select_admin" on public.cliente_alteracoes_contratuais to authenticated;
alter policy "cliente_atividades_select_qualquer_perfil" on public.cliente_atividades_mensais to authenticated;
alter policy "cliente_atividades_update_sn" on public.cliente_atividades_mensais to authenticated;
alter policy "cliente_atividades_upsert_sn" on public.cliente_atividades_mensais to authenticated;
alter policy "cliente_cadastro_operacional_select_qualquer_perfil" on public.cliente_cadastro_operacional_sn to authenticated;
alter policy "cliente_cadastro_operacional_update_sn" on public.cliente_cadastro_operacional_sn to authenticated;
alter policy "cliente_cadastro_operacional_upsert_sn" on public.cliente_cadastro_operacional_sn to authenticated;
alter policy "cliente_contatos_delete_sn" on public.cliente_contatos to authenticated;
alter policy "cliente_contatos_insert_sn" on public.cliente_contatos to authenticated;
alter policy "cliente_contatos_select_qualquer_perfil" on public.cliente_contatos to authenticated;
alter policy "clientes_insert_admin" on public.clientes to authenticated;
alter policy "clientes_select_admin" on public.clientes to authenticated;
alter policy "feriados_delete_admin" on public.feriados to authenticated;
alter policy "feriados_insert_admin" on public.feriados to authenticated;
alter policy "feriados_select_admin" on public.feriados to authenticated;
alter policy "perfis_insert_admin" on public.perfis to authenticated;
alter policy "perfis_insert_lider_proprio_setor" on public.perfis to authenticated;
alter policy "perfis_select_admin" on public.perfis to authenticated;
alter policy "perfis_select_mesmo_setor" on public.perfis to authenticated;
alter policy "perfis_select_proprio" on public.perfis to authenticated;
alter policy "registros_auditoria_select_admin" on public.registros_auditoria to authenticated;
alter policy "documentos_clientes_delete_admin" on storage.objects to authenticated;
alter policy "documentos_clientes_insert_admin" on storage.objects to authenticated;
alter policy "documentos_clientes_select_admin" on storage.objects to authenticated;

-- Funções do schema public que o PUBLIC implícito e o anon ainda executavam. `authenticated`
-- precisa delas (RPCs do app e helpers que o RLS chama) e `service_role` segue com os grants.
revoke execute on function public.acesso_liberado() from public, anon;
revoke execute on function public.atendimento_em_aviso_nao_muda_de_dono() from public, anon;
revoke execute on function public.criar_cliente(uuid, text, text, regime, text, jsonb) from public, anon;
revoke execute on function public.editar_cadastro_operacional_cliente(uuid, forma_envio, documento_obrigatorio_status, das_status, date, boolean, parcelamento_status, text, jsonb, date, boolean, boolean, boolean) from public, anon;
revoke execute on function public.meu_papel() from public, anon;
revoke execute on function public.meu_setor() from public, anon;
revoke execute on function public.pode_anexar_ao_atendimento(text) from public, anon;
revoke execute on function public.proteger_responsavel_cliente() from public, anon;

-- Objetos futuros criados por migrations (role postgres) nascem sem privilégio para anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

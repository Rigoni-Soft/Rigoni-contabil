-- Ticket #30: Admin cadastra Lider/Funcionario. A conta em auth.users e criada
-- via Admin API (service_role, fora de RLS -- ver docs/adr/0001); o INSERT em
-- perfis roda com a sessao do proprio Admin, por isso precisa de policy.
create policy "perfis_insert_admin"
  on public.perfis for insert
  with check (public.meu_papel() = 'admin');

-- Seed de desenvolvimento local: um Admin para login manual/e2e.
-- Senha: admin123 (só ambiente local, nunca usar em homolog/produção).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'admin@rigonicontabil.local',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);

-- Necessária desde que o GoTrue passou a exigir uma identidade por provider
-- (sem isso, signInWithPassword falha com "Database error querying schema").
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'admin@rigonicontabil.local'),
  'email',
  '11111111-1111-1111-1111-111111111111',
  now(), now(), now()
);

insert into public.perfis (id, nome, email, papel, setor)
values (
  '11111111-1111-1111-1111-111111111111',
  'Admin de Teste',
  'admin@rigonicontabil.local',
  'admin',
  'administrativo'
);

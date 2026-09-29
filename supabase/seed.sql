-- Seed de desenvolvimento local: Admin + usuários de setores/papéis distintos,
-- pra provar isolamento por RLS entre setores (testes.md, seção 3; revisão #28).
-- Senhas só ambiente local, nunca usar em homolog/produção.

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

-- Funcionário Simples Nacional
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'funcionario.sn@rigonicontabil.local',
  crypt('func123', gen_salt('bf')),
  now(), now(), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'funcionario.sn@rigonicontabil.local'),
  'email',
  '22222222-2222-2222-2222-222222222222',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor)
values (
  '22222222-2222-2222-2222-222222222222',
  'Funcionário Simples Nacional',
  'funcionario.sn@rigonicontabil.local',
  'funcionario',
  'simples_nacional'
);

-- Funcionário Financeiro
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated', 'authenticated', 'funcionario.financeiro@rigonicontabil.local',
  crypt('func123', gen_salt('bf')),
  now(), now(), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333',
  jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333', 'email', 'funcionario.financeiro@rigonicontabil.local'),
  'email',
  '33333333-3333-3333-3333-333333333333',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor)
values (
  '33333333-3333-3333-3333-333333333333',
  'Funcionário Financeiro',
  'funcionario.financeiro@rigonicontabil.local',
  'funcionario',
  'financeiro'
);

-- Segundo Funcionário Financeiro (mesmo setor do anterior) — prova a policy
-- "mesmo setor" (colega vê colega), não só "o próprio perfil".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555',
  'authenticated', 'authenticated', 'funcionario2.financeiro@rigonicontabil.local',
  crypt('func123', gen_salt('bf')),
  now(), now(), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '55555555-5555-5555-5555-555555555555',
  jsonb_build_object('sub', '55555555-5555-5555-5555-555555555555', 'email', 'funcionario2.financeiro@rigonicontabil.local'),
  'email',
  '55555555-5555-5555-5555-555555555555',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor)
values (
  '55555555-5555-5555-5555-555555555555',
  'Segundo Funcionário Financeiro',
  'funcionario2.financeiro@rigonicontabil.local',
  'funcionario',
  'financeiro'
);

-- Líder Contábil
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-4444-444444444444',
  'authenticated', 'authenticated', 'lider.contabil@rigonicontabil.local',
  crypt('lider123', gen_salt('bf')),
  now(), now(), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '44444444-4444-4444-4444-444444444444',
  jsonb_build_object('sub', '44444444-4444-4444-4444-444444444444', 'email', 'lider.contabil@rigonicontabil.local'),
  'email',
  '44444444-4444-4444-4444-444444444444',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor)
values (
  '44444444-4444-4444-4444-444444444444',
  'Líder Contábil',
  'lider.contabil@rigonicontabil.local',
  'lider_setor',
  'contabil'
);

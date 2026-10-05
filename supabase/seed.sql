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

-- senha_trocada_em = now(): contas de seed já usam senha "definitiva" (não
-- provisória) pros e2e existentes (#28/#29/#30) não caírem em /trocar-senha.
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '11111111-1111-1111-1111-111111111111',
  'Admin de Teste',
  'admin@rigonicontabil.local',
  'admin',
  'administrativo',
  now()
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
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '22222222-2222-2222-2222-222222222222',
  'Funcionário Simples Nacional',
  'funcionario.sn@rigonicontabil.local',
  'funcionario',
  'simples_nacional',
  now()
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
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '33333333-3333-3333-3333-333333333333',
  'Funcionário Financeiro',
  'funcionario.financeiro@rigonicontabil.local',
  'funcionario',
  'financeiro',
  now()
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
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '55555555-5555-5555-5555-555555555555',
  'Segundo Funcionário Financeiro',
  'funcionario2.financeiro@rigonicontabil.local',
  'funcionario',
  'financeiro',
  now()
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
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '44444444-4444-4444-4444-444444444444',
  'Líder Contábil',
  'lider.contabil@rigonicontabil.local',
  'lider_setor',
  'contabil',
  now()
);

-- Exemplos pro feed de auditoria (ticket #29): um sucesso e uma falha, pra exercitar
-- os filtros (setor, ação, alvo, resultado, período) no E2E e no `yarn dev`. IDs em
-- 7xxx pra não colidir visualmente com os ids de usuário acima (tabelas diferentes,
-- sem risco real de PK, mas evita confusão ao ler o seed).
insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
values (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  'simples_nacional',
  'usuario.criar',
  'funcionario.sn@rigonicontabil.local',
  'sucesso'
);

insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
values (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'financeiro',
  'cliente.editar',
  'CNPJ de teste',
  'falha'
);

-- Clientes de exemplo pro Resumo do setor (ticket #36): um por card da tabela
-- da spec #24, pra `yarn dev`/E2E já nascerem com os 9 buckets populados em
-- vez de zerados. IDs gerados com `crypto.randomUUID()` (uuid v4 de verdade:
-- a primeira leva usava "c1000000-...-000000000001", que falha
-- `z.string().uuid()` no form de edição — versão/variante inválidas, não é
-- um formato aceito, achado em teste manual: "dados inválidos" ao salvar).
-- CNPJs válidos (dígitos verificadores mod-11 reais), sem contrato social
-- (coluna opcional desde o #33).
insert into public.clientes (id, empresa, cnpj, regime) values
  ('078a3aae-80fc-4df7-b113-657873d96176', 'Padaria Selo Dourado DAS Emitida Ltda', '90000001000129', 'simples_nacional'),
  ('9238058c-cc25-4300-890e-93ca86288d41', 'Confecções Sem Documento Ltda', '90000002000173', 'simples_nacional'),
  ('68195e6c-03f6-4b15-8362-171a98175e13', 'Oficina DAS Pendente Urgente Ltda', '90000003000118', 'simples_nacional'),
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', 'Mercadinho Sem Movimento Ltda', '90000004000162', 'simples_nacional'),
  ('eec94956-1450-4ff1-b317-96546d30dd0e', 'Papelaria Esperando Envio Ltda', '90000005000107', 'simples_nacional'),
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'Auto Peças Parcelamento Pendente Ltda', '90000006000151', 'simples_nacional'),
  ('168178df-7d67-4925-b293-66e0ec2def9d', 'Floricultura Parcelamento Interno Ltda', '90000007000104', 'simples_nacional'),
  ('3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'Lanchonete Parcelamento Enviado Ltda', '90000008000140', 'simples_nacional'),
  ('99ad8a31-1450-454f-8b5a-75c14fa77498', 'Marcenaria MEI Selo Dourado Ltda', '90000009000195', 'mei');

-- Cada linha abaixo corresponde a exatamente 1 card da tabela da spec #24
-- (ver resumo-setor-sn.mapper.ts) — documento_obrigatorio aqui é o campo que
-- a UI rotula "Documento recebido" (#34).
insert into public.cliente_cadastro_operacional_sn
  (cliente_id, documento_obrigatorio, das_status, tem_parcelamento, parcelamento_status) values
  -- DAS emitidas (em dia/verde): DAS já enviada.
  ('078a3aae-80fc-4df7-b113-657873d96176', 'positivo', 'enviado', false, null),
  -- Sem documento (atenção): documento ainda não recebido.
  ('9238058c-cc25-4300-890e-93ca86288d41', 'negativo', 'pendente', false, null),
  -- DAS pendente (urgente): documento já recebido, DAS ainda não gerada.
  ('68195e6c-03f6-4b15-8362-171a98175e13', 'positivo', 'pendente', false, null),
  -- Sem movimento (informativo): não se aplica gerar DAS este mês.
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', 'nao_se_aplica', 'sem_movimento', false, null),
  -- Esperando envio DAS (andamento): DAS pronta, aguardando o job de envio.
  ('eec94956-1450-4ff1-b317-96546d30dd0e', 'positivo', 'pronto', false, null),
  -- Com parcelamento + Parcelamento pendente (urgente).
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'positivo', 'enviado', true, 'pendente'),
  -- Com parcelamento + Parcelamento interno (informativo).
  ('168178df-7d67-4925-b293-66e0ec2def9d', 'positivo', 'enviado', true, 'interno'),
  -- Com parcelamento + Parcelamento enviado (em dia/verde).
  ('3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'positivo', 'enviado', true, 'enviado'),
  -- MEI também aparece no resumo (#35 já cobre isso na busca) — mais um
  -- exemplo de "DAS emitidas".
  ('99ad8a31-1450-454f-8b5a-75c14fa77498', 'positivo', 'enviado', false, null);

-- Atividade do mês corrente (ticket #37) pro gráfico "Atividade do mês" já
-- nascer populado; flags independentes (um cliente pode ter mais de uma).
insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico) values
  (gen_random_uuid(), '078a3aae-80fc-4df7-b113-657873d96176', date_trunc('month', current_date)::date, true, true, false),
  (gen_random_uuid(), '9238058c-cc25-4300-890e-93ca86288d41', date_trunc('month', current_date)::date, true, false, false),
  (gen_random_uuid(), '68195e6c-03f6-4b15-8362-171a98175e13', date_trunc('month', current_date)::date, false, false, true),
  (gen_random_uuid(), '2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', date_trunc('month', current_date)::date, false, true, false),
  (gen_random_uuid(), 'ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', date_trunc('month', current_date)::date, false, true, true);

-- Líder e 2º Funcionário do Simples Nacional (ticket #65: Responsável por Cliente).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888',
  'authenticated', 'authenticated', 'lider.sn@rigonicontabil.local',
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
  '88888888-8888-8888-8888-888888888888',
  jsonb_build_object('sub', '88888888-8888-8888-8888-888888888888', 'email', 'lider.sn@rigonicontabil.local'),
  'email',
  '88888888-8888-8888-8888-888888888888',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '88888888-8888-8888-8888-888888888888',
  'Líder Simples Nacional',
  'lider.sn@rigonicontabil.local',
  'lider_setor',
  'simples_nacional',
  now()
);
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-9999-9999-999999999999',
  'authenticated', 'authenticated', 'funcionario2.sn@rigonicontabil.local',
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
  '99999999-9999-9999-9999-999999999999',
  jsonb_build_object('sub', '99999999-9999-9999-9999-999999999999', 'email', 'funcionario2.sn@rigonicontabil.local'),
  'email',
  '99999999-9999-9999-9999-999999999999',
  now(), now(), now()
);
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
values (
  '99999999-9999-9999-9999-999999999999',
  'Funcionário 2 Simples Nacional',
  'funcionario2.sn@rigonicontabil.local',
  'funcionario',
  'simples_nacional',
  now()
);
-- Funcionário SN (22222222...) é Responsável pelos clientes de exemplo, pra
-- continuar enxergando o resumo populado (ticket #65: Funcionário só vê o que é dele).
update public.cliente_cadastro_operacional_sn
set responsavel_id = '22222222-2222-2222-2222-222222222222';

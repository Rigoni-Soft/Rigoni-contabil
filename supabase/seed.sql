
with usuario (id, email, senha, nome, papel, setor) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@rigonicontabil.local', 'admin123',
     'Admin de Teste', 'admin'::public.papel, 'administrativo'::public.setor_slug),
    ('22222222-2222-2222-2222-222222222222', 'funcionario.sn@rigonicontabil.local', 'func123',
     'Funcionário Simples Nacional', 'funcionario', 'simples_nacional'),
    ('33333333-3333-3333-3333-333333333333', 'funcionario.financeiro@rigonicontabil.local', 'func123',
     'Funcionário Financeiro', 'funcionario', 'financeiro'),
    ('55555555-5555-5555-5555-555555555555', 'funcionario2.financeiro@rigonicontabil.local', 'func123',
     'Segundo Funcionário Financeiro', 'funcionario', 'financeiro'),
    ('44444444-4444-4444-4444-444444444444', 'lider.contabil@rigonicontabil.local', 'lider123',
     'Líder Contábil', 'lider_setor', 'contabil'),
    ('88888888-8888-8888-8888-888888888888', 'lider.sn@rigonicontabil.local', 'lider123',
     'Líder Simples Nacional', 'lider_setor', 'simples_nacional'),
    ('99999999-9999-9999-9999-999999999999', 'funcionario2.sn@rigonicontabil.local', 'func123',
     'Funcionário 2 Simples Nacional', 'funcionario', 'simples_nacional'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'funcionario.recepcao@rigonicontabil.local', 'func123',
     'Funcionário Recepção', 'funcionario', 'recepcao'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'funcionario2.recepcao@rigonicontabil.local', 'func123',
     'Segundo Funcionário Recepção', 'funcionario', 'recepcao'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'lider.rh@rigonicontabil.local', 'lider123',
     'Líder RH', 'lider_setor', 'rh'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'funcionario.rh@rigonicontabil.local', 'func123',
     'Funcionário RH', 'funcionario', 'rh'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'funcionario2.rh@rigonicontabil.local', 'func123',
     'Segundo Funcionário RH', 'funcionario', 'rh')
),
conta as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    crypt(senha, gen_salt('bf')),
    now(), now(), now(),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  from usuario
  returning id
),
identidade as (
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  select
    gen_random_uuid(), id,
    jsonb_build_object('sub', id::text, 'email', email),
    'email', id::text,
    now(), now(), now()
  from usuario
  returning user_id
)
insert into public.perfis (id, nome, email, papel, setor, senha_trocada_em)
select id, nome, email, papel, setor, now() from usuario;

insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111',
   'simples_nacional', 'usuario.criar', 'funcionario.sn@rigonicontabil.local', 'sucesso'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   'financeiro', 'cliente.editar', 'CNPJ de teste', 'falha');

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

insert into public.cliente_cadastro_operacional_sn
  (cliente_id, documento_obrigatorio, das_status)
values
  ('078a3aae-80fc-4df7-b113-657873d96176', 'positivo', 'enviado'),
  ('9238058c-cc25-4300-890e-93ca86288d41', 'negativo', 'pendente'),
  ('68195e6c-03f6-4b15-8362-171a98175e13', 'positivo', 'pendente'),
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', 'nao_se_aplica', 'sem_movimento'),
  ('eec94956-1450-4ff1-b317-96546d30dd0e', 'positivo', 'pronto'),
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'positivo', 'enviado'),
  ('168178df-7d67-4925-b293-66e0ec2def9d', 'positivo', 'enviado'),
  ('3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'positivo', 'enviado'),
  ('99ad8a31-1450-454f-8b5a-75c14fa77498', 'positivo', 'enviado');

insert into public.cliente_responsaveis (cliente_id, setor, responsavel_id)
select id, 'simples_nacional', '22222222-2222-2222-2222-222222222222'
from public.clientes;

insert into public.cliente_parcelamentos (id, cliente_id, setor, codigo, parcelas_restantes, interno, arquivo_caminho)
values
  ('a1000000-0000-4000-8000-000000000001', 'ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'simples_nacional', 'PARC-0001', 24, false, 'ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8/seed-pendente.pdf'),
  ('a1000000-0000-4000-8000-000000000002', '168178df-7d67-4925-b293-66e0ec2def9d', 'simples_nacional', 'PARC-0002', 12, true, '168178df-7d67-4925-b293-66e0ec2def9d/seed-interno.pdf'),
  ('a1000000-0000-4000-8000-000000000003', '3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'simples_nacional', 'PARC-0003', 6, false, '3e999809-f99b-4b51-9fb9-07d37a5b3c23/seed-enviado.pdf');

insert into public.cliente_parcelamento_envios (parcelamento_id, parcela)
values ('a1000000-0000-4000-8000-000000000003', to_char(public.mes_corrente_sp(), 'YYYYMM'));

insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
select gen_random_uuid(), cliente_id::uuid, date_trunc('month', current_date)::date, industria, comercio, servico
from (values
  ('078a3aae-80fc-4df7-b113-657873d96176', true, true, false),
  ('9238058c-cc25-4300-890e-93ca86288d41', true, false, false),
  ('68195e6c-03f6-4b15-8362-171a98175e13', false, false, true),
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', false, true, false),
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', false, true, true)
) as atividade (cliente_id, industria, comercio, servico);

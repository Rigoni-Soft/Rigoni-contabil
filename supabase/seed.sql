-- Seed de desenvolvimento local: Admin + usuários de setores/papéis distintos,
-- pra provar isolamento por RLS entre setores (testes.md, seção 3; revisão #28).
-- Senhas só ambiente local, nunca usar em homolog/produção.

-- Uma linha por usuário; a conta (auth.users), a identidade e o perfil saem da mesma lista.
-- A identidade por provider é necessária desde que o GoTrue passou a exigi-la (sem ela,
-- signInWithPassword falha com "Database error querying schema"). senha_trocada_em = now():
-- contas de seed já usam senha "definitiva" (não provisória) pros e2e não caírem em /trocar-senha.
-- Os ids repetidos (1111…, 2222…) são o que os testes referenciam; não renumerar.
with usuario (id, email, senha, nome, papel, setor) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@rigonicontabil.local', 'admin123',
     'Admin de Teste', 'admin'::public.papel, 'administrativo'::public.setor_slug),
    ('22222222-2222-2222-2222-222222222222', 'funcionario.sn@rigonicontabil.local', 'func123',
     'Funcionário Simples Nacional', 'funcionario', 'simples_nacional'),
    ('33333333-3333-3333-3333-333333333333', 'funcionario.financeiro@rigonicontabil.local', 'func123',
     'Funcionário Financeiro', 'funcionario', 'financeiro'),
    -- Mesmo setor do anterior: prova a policy "mesmo setor" (colega vê colega), não só o próprio perfil.
    ('55555555-5555-5555-5555-555555555555', 'funcionario2.financeiro@rigonicontabil.local', 'func123',
     'Segundo Funcionário Financeiro', 'funcionario', 'financeiro'),
    ('44444444-4444-4444-4444-444444444444', 'lider.contabil@rigonicontabil.local', 'lider123',
     'Líder Contábil', 'lider_setor', 'contabil'),
    -- Líder e 2º Funcionário do Simples Nacional (#65: Responsável por Cliente).
    ('88888888-8888-8888-8888-888888888888', 'lider.sn@rigonicontabil.local', 'lider123',
     'Líder Simples Nacional', 'lider_setor', 'simples_nacional'),
    ('99999999-9999-9999-9999-999999999999', 'funcionario2.sn@rigonicontabil.local', 'func123',
     'Funcionário 2 Simples Nacional', 'funcionario', 'simples_nacional')
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

-- Exemplos pro feed de auditoria (ticket #29): um sucesso e uma falha, pra exercitar os filtros
-- (setor, ação, alvo, resultado, período) no E2E e no `yarn dev`. IDs em 7xxx/6xxx só pra não se
-- confundir com os ids de usuário acima (tabelas diferentes, sem risco real de PK).
insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111',
   'simples_nacional', 'usuario.criar', 'funcionario.sn@rigonicontabil.local', 'sucesso'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   'financeiro', 'cliente.editar', 'CNPJ de teste', 'falha');

-- Clientes de exemplo pro Resumo do setor (ticket #36): um por card da tabela da spec #24, pra
-- `yarn dev`/E2E já nascerem com os 9 buckets populados em vez de zerados. Os ids são uuid v4 de
-- verdade (`z.string().uuid()` do form de edição recusa os de versão/variante inválidas).
-- CNPJs válidos (dígitos verificadores mod-11 reais), sem contrato social (opcional desde o #33).
-- Cada linha do cadastro corresponde a exatamente 1 card (ver resumo-setor-sn.mapper.ts);
-- documento_obrigatorio é o campo que a UI rotula "Documento recebido" (#34).
insert into public.clientes (id, empresa, cnpj, regime) values
  ('078a3aae-80fc-4df7-b113-657873d96176', 'Padaria Selo Dourado DAS Emitida Ltda', '90000001000129', 'simples_nacional'),
  ('9238058c-cc25-4300-890e-93ca86288d41', 'Confecções Sem Documento Ltda', '90000002000173', 'simples_nacional'),
  ('68195e6c-03f6-4b15-8362-171a98175e13', 'Oficina DAS Pendente Urgente Ltda', '90000003000118', 'simples_nacional'),
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', 'Mercadinho Sem Movimento Ltda', '90000004000162', 'simples_nacional'),
  ('eec94956-1450-4ff1-b317-96546d30dd0e', 'Papelaria Esperando Envio Ltda', '90000005000107', 'simples_nacional'),
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'Auto Peças Parcelamento Pendente Ltda', '90000006000151', 'simples_nacional'),
  ('168178df-7d67-4925-b293-66e0ec2def9d', 'Floricultura Parcelamento Interno Ltda', '90000007000104', 'simples_nacional'),
  ('3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'Lanchonete Parcelamento Enviado Ltda', '90000008000140', 'simples_nacional'),
  -- MEI também aparece no resumo (#35 já cobre isso na busca): mais um exemplo de "DAS emitidas".
  ('99ad8a31-1450-454f-8b5a-75c14fa77498', 'Marcenaria MEI Selo Dourado Ltda', '90000009000195', 'mei');

-- Funcionário SN (2222…) é Responsável por todos, pra continuar enxergando o resumo populado
-- (#65: Funcionário só vê o que é dele).
insert into public.cliente_cadastro_operacional_sn
  (cliente_id, documento_obrigatorio, das_status, tem_parcelamento, parcelamento_status, responsavel_id)
values
  -- DAS emitidas (em dia/verde): DAS já enviada.
  ('078a3aae-80fc-4df7-b113-657873d96176', 'positivo', 'enviado', false, null, '22222222-2222-2222-2222-222222222222'),
  -- Sem documento (atenção): documento ainda não recebido.
  ('9238058c-cc25-4300-890e-93ca86288d41', 'negativo', 'pendente', false, null, '22222222-2222-2222-2222-222222222222'),
  -- DAS pendente (urgente): documento já recebido, DAS ainda não gerada.
  ('68195e6c-03f6-4b15-8362-171a98175e13', 'positivo', 'pendente', false, null, '22222222-2222-2222-2222-222222222222'),
  -- Sem movimento (informativo): não se aplica gerar DAS este mês.
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', 'nao_se_aplica', 'sem_movimento', false, null, '22222222-2222-2222-2222-222222222222'),
  -- Esperando envio DAS (andamento): DAS pronta, aguardando o job de envio.
  ('eec94956-1450-4ff1-b317-96546d30dd0e', 'positivo', 'pronto', false, null, '22222222-2222-2222-2222-222222222222'),
  -- Com parcelamento + Parcelamento pendente (urgente).
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', 'positivo', 'enviado', true, 'pendente', '22222222-2222-2222-2222-222222222222'),
  -- Com parcelamento + Parcelamento interno (informativo).
  ('168178df-7d67-4925-b293-66e0ec2def9d', 'positivo', 'enviado', true, 'interno', '22222222-2222-2222-2222-222222222222'),
  -- Com parcelamento + Parcelamento enviado (em dia/verde).
  ('3e999809-f99b-4b51-9fb9-07d37a5b3c23', 'positivo', 'enviado', true, 'enviado', '22222222-2222-2222-2222-222222222222'),
  ('99ad8a31-1450-454f-8b5a-75c14fa77498', 'positivo', 'enviado', false, null, '22222222-2222-2222-2222-222222222222');

-- Atividade do mês corrente (ticket #37) pro gráfico "Atividade do mês" já nascer populado;
-- flags independentes (um cliente pode ter mais de uma).
insert into public.cliente_atividades_mensais (id, cliente_id, ano_mes, industria, comercio, servico)
select gen_random_uuid(), cliente_id::uuid, date_trunc('month', current_date)::date, industria, comercio, servico
from (values
  ('078a3aae-80fc-4df7-b113-657873d96176', true, true, false),
  ('9238058c-cc25-4300-890e-93ca86288d41', true, false, false),
  ('68195e6c-03f6-4b15-8362-171a98175e13', false, false, true),
  ('2d0b7e0a-f1f1-410f-bdbc-a16e34e4c215', false, true, false),
  ('ef2c35e9-00b9-4fbc-8f8d-06b9d1aa20e8', false, true, true)
) as atividade (cliente_id, industria, comercio, servico);

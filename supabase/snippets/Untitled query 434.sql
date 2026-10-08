with c as (select id from public.clientes where cnpj = '11444777000161'),
contato as (
  insert into public.cliente_contatos (id, cliente_id, nome, telefone, padrao)
  select gen_random_uuid(), id, 'Dona Maria', '(61) 95557-3001', true from c
),
at as (
  insert into public.atendimentos (telefone, chave_telefone, cliente_id, setor, funcionario_id, assumido_em)
  select '5561955573001', '61955573001', id, 'financeiro',
         '55555555-5555-5555-5555-555555555555', now() from c
  returning id
)
insert into public.mensagens (atendimento_id, autor, texto, criado_em)
select at.id, m.autor::public.autor_mensagem, m.texto, now() + m.o * interval '1 second'
from at, (values ('contato','Preciso do contrato social',0),
                 ('ura','Vou te encaminhar para um atendente',1)) as m(autor, texto, o);
insert into public.clientes (id, empresa, cnpj, regime) values
 ('a2210000-0000-4000-8000-0000000000a1', 'Teste Holerite Ltda', '70000041000163', 'lucro_presumido'),
 ('a2210000-0000-4000-8000-0000000000b1', 'Teste Vazio Ltda', '70000042000108', 'lucro_presumido');

insert into public.cliente_responsaveis (cliente_id, setor, responsavel_id) values
 ('a2210000-0000-4000-8000-0000000000a1', 'rh', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
 ('a2210000-0000-4000-8000-0000000000b1', 'rh', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

insert into public.rh_convencoes
 (cliente_id, sindicato, vigencia_inicio, vigencia_fim, arquivo_caminho, arquivo_nome, regras)
values (
 'a2210000-0000-4000-8000-0000000000a1', 'Comércio', '2025-05-01', '2026-04-30',
 'roteiro/antiga.pdf', 'antiga.pdf',
 $json${"versao": 1, "aplicadas": [{"chave": "extra_sabado", "valor": 70, "clausula": "12ª", "trecho": "70%"}], "rejeitadas": []}$json$::jsonb
);

-- passo 4.3 --
insert into public.feriados (data, descricao) values ('2026-11-20', 'Consciência Negra');

-- passo 5.14 --
select * from public.rh_cartoes_do_mes('2026-11-01');

-- passos 1.18 e 3.9 --
select acao, alvo from public.registros_auditoria
where acao like 'rh.%' order by criado_em desc limit 15;
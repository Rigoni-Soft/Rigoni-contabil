insert into mensagens (atendimento_id, autor, texto, id_externo)
select id, 'contato', 'Pode reagir aqui', 'wamid.MANUAL-1'
from atendimentos
where status = 'em_andamento'
order by criado_em desc
limit 1;
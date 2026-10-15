-- HISTÓRICO: as migrations citadas abaixo foram consolidadas em 20260924190000_usuarios_e_auditoria.sql
-- (e as demais da família). Este preflight só vale para uma base que ainda esteja no estado anterior
-- à consolidação; em base nova ou resetada não há o que conferir.
-- Preflight SOMENTE LEITURA da migration 20261005090000_alterar_papel_usuario.sql
-- Rode no Supabase da Rigoni ANTES do deploy.
-- Nada aqui altera ou apaga dado.
--
-- 1) Setores com mais de um Líder ativo: o CREATE UNIQUE INDEX
--    perfis_um_lider_ativo_por_setor falha enquanto esta consulta devolver linhas.
--    Antes da #58 não existe a coluna desativado_em: todo Líder conta como ativo.
select setor, count(*) as lideres_ativos, array_agg(email order by email) as emails
from public.perfis
where papel = 'lider_setor'
group by setor
having count(*) > 1;

-- 2) Histórico de migrations já aplicado (confirma que 20261003090000 e 20261003091000
--    ainda não rodaram e que nada posterior a 20261002130000 quebra a ordem).
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 10;

-- Se (1) devolver linhas: decidir com a Rigoni qual Líder permanece e rebaixar
-- os demais pela tela de usuários (ou desativá-los) ANTES do deploy. Sem exclusão
-- automática. Depois do deploy, conferir:
--   select indexname from pg_indexes where indexname = 'perfis_um_lider_ativo_por_setor';

-- Reconcilia o histórico de migrations da produção com o baseline (d69d065f).
-- Só mexe em supabase_migrations.schema_migrations: nenhuma tabela de negócio é tocada,
-- nenhum dado é apagado. Rode uma vez, no SQL Editor do projeto, antes do db push.
-- Aborta sem alterar nada se faltar qualquer uma das 43 migrations antigas ou se houver outra versão que não seja posterior ao baseline.
-- Versões posteriores ao baseline já registradas são preservadas.

do $$
declare
  antigas text[] := array[
    '20260924190000',
    '20261002110000',
    '20261005120000',
    '20261006090000',
    '20261008090000',
    '20261014130000',
    '20261017090000',
    '20261020100000',
    '20261020110000',
    '20261021090000',
    '20261021100000',
    '20261021110000',
    '20261022090000',
    '20261022100000',
    '20261022110000',
    '20261022120000',
    '20261023100000',
    '20261023104000',
    '20261024100000',
    '20261024105000',
    '20261024108000',
    '20261024110000',
    '20261026100000',
    '20261026110000',
    '20261026120000',
    '20261026130000',
    '20261026140000',
    '20261027100000',
    '20261027105000',
    '20261027110000',
    '20261027120000',
    '20261028100000',
    '20261028110000',
    '20261028120000',
    '20261028130000',
    '20261028140000',
    '20261028150000',
    '20261028160000',
    '20261028170000',
    '20261028180000',
    '20261029120000',
    '20261029140000',
    '20261029150000'
  ];
  presentes int;
  estranhas int;
begin
  select count(*) into presentes from supabase_migrations.schema_migrations where version = any (antigas);
  -- Fora das 43 antigas só se aceita versão posterior ao baseline (já aplicada depois dele); o baseline em si não pode estar lá.
  select count(*) into estranhas from supabase_migrations.schema_migrations
    where version <> all (antigas) and version <= '20261030090000';

  if presentes <> 43 or estranhas <> 0 then
    raise exception 'histórico inesperado: % das 43 antigas presentes, % versões fora delas e não posteriores ao baseline. Nada foi alterado.', presentes, estranhas;
  end if;

  delete from supabase_migrations.schema_migrations where version = any (antigas);

  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261030090000', 'baseline');
end
$$;

select version from supabase_migrations.schema_migrations order by version;

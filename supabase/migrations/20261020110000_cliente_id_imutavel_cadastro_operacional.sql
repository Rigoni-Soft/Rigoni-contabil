-- `cliente_id` não muda com sessão de usuário (#120): o UPDATE autorizado de um Admin trocava a
-- chave e levava a linha (ex.: Atividade do mês) de um Cliente para outro. O guard vai na função
-- que já protege as tabelas do cadastro operacional; cobre também `cliente_cadastro_operacional_sn`.
-- `cliente_contatos` não recebe UPDATE (grant só de select/insert/delete), não há o que travar.
-- Sem sessão (job, seed, migration) nada muda.
CREATE OR REPLACE FUNCTION public.proteger_cadastro_operacional() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid := case when tg_op = 'DELETE' then old.cliente_id else new.cliente_id end;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'O Cliente do cadastro operacional não pode ser trocado.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.clientes
    where id = v_cliente_id and regime in ('simples_nacional', 'mei')
  ) then
    raise exception 'Cadastro operacional SN não se aplica a este Regime.' using errcode = '23514';
  end if;
  if tg_table_name = 'cliente_atividades_mensais' then
    if new.ano_mes <> public.mes_corrente_sp()
       or (tg_op = 'UPDATE' and old.ano_mes <> public.mes_corrente_sp()) then
      raise exception 'Só a Atividade do mês corrente é editável.' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

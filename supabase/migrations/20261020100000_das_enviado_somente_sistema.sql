-- DAS `enviado` e `data_envio_das` são só do sistema (#108): quem grava é a conclusão do envio
-- (`concluir_envio_automatico_das`, chamada pelo job com service_role, sem `auth.uid()`).
-- Pessoa nenhuma (nem Admin) define `enviado` nem altera a data, seja pela RPC de edição
-- (`editar_cadastro_operacional_cliente`) ou por DML direto da Data API: por isso a trava é um
-- gatilho BEFORE na tabela (arquitetura.md §3.14), não código da RPC. A RPC não muda.
--
-- Para quem tem sessão (`auth.uid()` não nulo):
--   * `enviado` só se mantém — nunca nasce da edição manual (erro 23514);
--   * a data de envio é derivada: preservada enquanto o status segue `enviado`, nula nos demais
--     (o valor que a pessoa mandar é descartado, sem erro: a tela só exibe).
-- Sem sessão (job, seed, migration) nada muda.
CREATE FUNCTION public.proteger_das_enviado_do_sistema() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_atual public.das_status;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- No upsert da RPC de edição o gatilho de INSERT roda antes do ON CONFLICT: o status atual é o
  -- da linha já existente, não o da linha proposta.
  if tg_op = 'UPDATE' then
    v_atual := old.das_status;
  else
    select das_status into v_atual from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id;
  end if;

  if new.das_status = 'enviado' and v_atual is distinct from 'enviado' then
    raise exception 'O status DAS "enviado" é definido apenas pelo sistema.' using errcode = '23514';
  end if;

  -- Data derivada: no INSERT vai nula (se já havia linha, o UPDATE do ON CONFLICT a restaura aqui).
  if tg_op = 'UPDATE' and new.das_status = 'enviado' then
    new.data_envio_das := old.data_envio_das;
  else
    new.data_envio_das := null;
  end if;

  return new;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_das_enviado_do_sistema() FROM PUBLIC, anon;

CREATE TRIGGER cliente_cadastro_operacional_proteger_das BEFORE INSERT OR UPDATE ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.proteger_das_enviado_do_sistema();

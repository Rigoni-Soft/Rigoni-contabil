-- Motivo de a guia da parcela PGFN ter ficado "a confirmar" ao anexar (#185): o leitor do PDF devolve
-- o que o Funcionário deve conferir (conta diferente, PDF não lido...). Grava junto da linha para o
-- motivo sobreviver ao recarregar a tela. Nulo = nasceu confirmada, ou foi anexada antes da leitura.
-- Confirmar a guia (à mão ou na hora) apaga o motivo: não há mais o que conferir.

ALTER TABLE public.cliente_parcelamento_guias ADD COLUMN motivo text;

ALTER TABLE public.cliente_parcelamento_guias
  ADD CONSTRAINT cliente_parcelamento_guias_motivo_check CHECK (motivo IS NULL OR length(motivo) <= 300);

CREATE OR REPLACE FUNCTION public.proteger_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1 from public.cliente_parcelamento_envios e
     where e.parcelamento_id = new.parcelamento_id and e.parcela = new.competencia
  ) then
    raise exception 'Competência já enviada: não aceita guia nova nem alteração.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.cliente_parcelamentos p where p.id = new.parcelamento_id and p.origem = 'pgfn'
    ) then
      raise exception 'Só Parcelamento da PGFN recebe guia anexada.' using errcode = '23514';
    end if;
    new.estado := 'a_confirmar';
    new.anexado_por := auth.uid();
    new.anexado_em := now();
    new.confirmado_por := null;
    new.confirmado_em := null;
    return new;
  end if;

  if old.estado = 'confirmada' or new.estado is distinct from 'confirmada' then
    raise exception 'A guia só muda de "a confirmar" para confirmada.' using errcode = '23514';
  end if;
  new.confirmado_por := auth.uid();
  new.confirmado_em := now();
  new.motivo := null;
  return new;
end;
$$;

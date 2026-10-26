-- Guia anexada da parcela PGFN (#183): o PDF da guia do mês de um Parcelamento de origem PGFN, com a
-- competência (AAAAMM) e a conta de negociação informadas à mão. Uma linha por (Parcelamento,
-- competência); nasce "a confirmar" e só a confirmação à mão a libera para envio. É separada do
-- registro de envio, que continua só do sistema (ADR 0008) e é o único que desconta a parcela.
-- Mesma visibilidade e edição do Parcelamento; o arquivo vai no bucket privado dos acordos, sem
-- policy de usuário (só o servidor lê e grava).

CREATE TYPE public.guia_parcela_pgfn_estado AS ENUM ('a_confirmar', 'confirmada');

CREATE TABLE public.cliente_parcelamento_guias (
    parcelamento_id uuid NOT NULL,
    competencia text NOT NULL,
    conta_negociacao text NOT NULL,
    arquivo_caminho text NOT NULL,
    estado public.guia_parcela_pgfn_estado DEFAULT 'a_confirmar'::public.guia_parcela_pgfn_estado NOT NULL,
    anexado_por uuid,
    anexado_em timestamp with time zone DEFAULT now() NOT NULL,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    CONSTRAINT cliente_parcelamento_guias_pkey PRIMARY KEY (parcelamento_id, competencia),
    CONSTRAINT cliente_parcelamento_guias_parcelamento_id_fkey FOREIGN KEY (parcelamento_id) REFERENCES public.cliente_parcelamentos(id) ON DELETE CASCADE,
    CONSTRAINT cliente_parcelamento_guias_anexado_por_fkey FOREIGN KEY (anexado_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
    CONSTRAINT cliente_parcelamento_guias_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
    CONSTRAINT cliente_parcelamento_guias_competencia_check CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
    CONSTRAINT cliente_parcelamento_guias_conta_check CHECK (length(btrim(conta_negociacao)) BETWEEN 1 AND 40)
);

-- Regras da sessão de usuário (RPC ou Data API). Sem auth.uid() (job, seed, migration, cascata de um
-- Cliente) o chamador é o servidor confiável e nada muda. Quem anexou, quem confirmou e quando são
-- do banco: o valor que o chamador mandar é descartado.
CREATE FUNCTION public.proteger_cliente_parcelamento_guia() RETURNS trigger
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
  return new;
end;
$$;

-- Auditoria de sucesso na mesma transação: quem anexou, quem confirmou e quando. Ator e setor vêm
-- da sessão do banco, nunca do chamador.
CREATE FUNCTION public.auditar_cliente_parcelamento_guia() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (
    gen_random_uuid(), auth.uid(), public.meu_setor(),
    case tg_op when 'INSERT' then 'parcelamento.anexar-guia' else 'parcelamento.confirmar-guia' end,
    (select c.cnpj || ' - ' || p.codigo || ' - ' || new.competencia
       from public.cliente_parcelamentos p join public.clientes c on c.id = p.cliente_id
      where p.id = new.parcelamento_id),
    'sucesso', now()
  );
  return null;
end;
$$;

CREATE TRIGGER cliente_parcelamento_guias_proteger BEFORE INSERT OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.proteger_cliente_parcelamento_guia();

CREATE TRIGGER cliente_parcelamento_guias_auditar AFTER INSERT OR UPDATE ON public.cliente_parcelamento_guias FOR EACH ROW EXECUTE FUNCTION public.auditar_cliente_parcelamento_guia();

ALTER TABLE public.cliente_parcelamento_guias ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_parcelamento_guias_select ON public.cliente_parcelamento_guias FOR SELECT
  USING (exists (select 1 from public.cliente_parcelamentos p where p.id = parcelamento_id));

CREATE POLICY cliente_parcelamento_guias_insert ON public.cliente_parcelamento_guias FOR INSERT
  WITH CHECK (exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = parcelamento_id and public.pode_editar_cadastro_operacional(p.cliente_id)
  ));

CREATE POLICY cliente_parcelamento_guias_update ON public.cliente_parcelamento_guias FOR UPDATE
  USING (exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = parcelamento_id and public.pode_editar_cadastro_operacional(p.cliente_id)
  ))
  WITH CHECK (exists (
    select 1 from public.cliente_parcelamentos p
     where p.id = parcelamento_id and public.pode_editar_cadastro_operacional(p.cliente_id)
  ));

-- anon não recebe nada. A sessão lê, anexa e só confirma (UPDATE só da coluna `estado`); remoção e
-- troca não existem neste ticket, então não há DELETE para a sessão.
grant select, insert on table public.cliente_parcelamento_guias to authenticated;
grant update (estado) on table public.cliente_parcelamento_guias to authenticated;
grant all on table public.cliente_parcelamento_guias to service_role;

revoke all on function public.proteger_cliente_parcelamento_guia() from public, anon, authenticated;
grant execute on function public.proteger_cliente_parcelamento_guia() to service_role;
revoke all on function public.auditar_cliente_parcelamento_guia() from public, anon, authenticated;
grant execute on function public.auditar_cliente_parcelamento_guia() to service_role;

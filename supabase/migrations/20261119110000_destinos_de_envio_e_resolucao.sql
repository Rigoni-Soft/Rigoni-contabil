-- Destinos de envio por Setor (ADR 0013): (Cliente, Setor, Tipo de envio, Contato, canal) e a resolução
-- "quem recebe este envio" no banco. O tipo nulo é "todos os envios do Setor" (o padrão); um tipo do
-- catálogo vale para aquele tipo e, sem ele, valem os "todos". O canal é do Destino e sempre gravado
-- explícito (WhatsApp, e-mail ou os dois). A migration não cria Destinos: o SN começa sem nenhum.

-- Catálogo fixo dos tipos de envio que o sistema faz hoje (FGTS e folha para assinar entram quando existirem).
CREATE TABLE public.tipos_de_envio (
    slug text NOT NULL,
    rotulo text NOT NULL,
    CONSTRAINT tipos_de_envio_pkey PRIMARY KEY (slug),
    CONSTRAINT tipos_de_envio_rotulo_check CHECK (btrim(rotulo) <> '')
);
INSERT INTO public.tipos_de_envio (slug, rotulo) VALUES
    ('lembrete_documento', 'Lembrete de documento'),
    ('das', 'DAS'),
    ('guia_parcelamento', 'Guia de parcelamento'),
    ('avisos', 'Avisos');

-- Quais tipos cada Setor envia.
CREATE TABLE public.tipos_de_envio_do_setor (
    setor public.setor_slug NOT NULL,
    tipo text NOT NULL REFERENCES public.tipos_de_envio(slug),
    CONSTRAINT tipos_de_envio_do_setor_pkey PRIMARY KEY (setor, tipo)
);
INSERT INTO public.tipos_de_envio_do_setor (setor, tipo) VALUES
    ('simples_nacional', 'lembrete_documento'),
    ('simples_nacional', 'das'),
    ('simples_nacional', 'guia_parcelamento'),
    ('simples_nacional', 'avisos'),
    ('rh', 'guia_parcelamento'),
    ('rh', 'avisos');

ALTER TABLE public.tipos_de_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_de_envio_do_setor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor TO authenticated;
GRANT ALL ON TABLE public.tipos_de_envio, public.tipos_de_envio_do_setor TO service_role;
CREATE POLICY tipos_de_envio_select ON public.tipos_de_envio FOR SELECT TO authenticated USING (true);
CREATE POLICY tipos_de_envio_do_setor_select ON public.tipos_de_envio_do_setor FOR SELECT TO authenticated USING (true);

-- O Destino aponta o Contato do mesmo Cliente (chave composta).
ALTER TABLE public.cliente_contatos
    ADD CONSTRAINT cliente_contatos_id_cliente_unico UNIQUE (id, cliente_id);

CREATE TABLE public.destinos_de_envio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    setor public.setor_slug NOT NULL,
    tipo text,
    contato_id uuid NOT NULL,
    canal public.forma_envio NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT destinos_de_envio_pkey PRIMARY KEY (id),
    CONSTRAINT destinos_de_envio_contato_fkey FOREIGN KEY (contato_id, cliente_id)
        REFERENCES public.cliente_contatos(id, cliente_id) ON DELETE CASCADE,
    -- Tipo nulo ("todos") não passa pela checagem; um tipo precisa existir para o Setor.
    CONSTRAINT destinos_de_envio_tipo_fkey FOREIGN KEY (setor, tipo)
        REFERENCES public.tipos_de_envio_do_setor(setor, tipo)
);
CREATE UNIQUE INDEX destinos_de_envio_unico
    ON public.destinos_de_envio (cliente_id, setor, COALESCE(tipo, ''), contato_id);
CREATE INDEX destinos_de_envio_contato_idx ON public.destinos_de_envio (contato_id);

-- O canal gravado precisa existir no Contato na hora de gravar.
CREATE FUNCTION public.destino_validar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_contato public.cliente_contatos;
begin
  -- DEFINER lê fora da RLS: só o contato do próprio Cliente do destino; o de outro Cliente (ou
  -- inexistente) cai na FK composta, sem revelar o nome.
  select * into v_contato from public.cliente_contatos
  where id = new.contato_id and cliente_id = new.cliente_id;
  if not found then
    raise exception 'O contato do destino não pertence a este Cliente.' using errcode = '23503';
  end if;
  if new.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(v_contato.telefone) is null then
    raise exception 'O contato "%" não tem WhatsApp.', v_contato.nome using errcode = '23514';
  end if;
  if new.canal in ('email', 'whatsapp_e_email') and v_contato.email is null then
    raise exception 'O contato "%" não tem e-mail.', v_contato.nome using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.cliente_id is distinct from old.cliente_id
                           or new.setor is distinct from old.setor
                           or new.contato_id is distinct from old.contato_id) then
    raise exception 'O Cliente, o Setor e o contato do destino não podem ser trocados.' using errcode = '23514';
  end if;
  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.destino_validar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destino_validar() TO service_role;
CREATE TRIGGER destinos_de_envio_validar BEFORE INSERT OR UPDATE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.destino_validar();

-- Os Setores do Contato são os que o usam: usar entra, deixar de usar sai (o dono e a URA ficam).
CREATE FUNCTION public.destino_sincronizar_setores_do_contato() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.cliente_contato_setores (contato_id, setor)
    values (new.contato_id, new.setor::text)
    on conflict do nothing;
  else
    delete from public.cliente_contato_setores v
    where v.contato_id = old.contato_id and v.setor = old.setor::text
      and not exists (select 1 from public.destinos_de_envio d
                      where d.contato_id = old.contato_id and d.setor = old.setor)
      and not exists (select 1 from public.cliente_contatos c
                      where c.id = old.contato_id and c.dono_setor = old.setor);
  end if;
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.destino_sincronizar_setores_do_contato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destino_sincronizar_setores_do_contato() TO service_role;
CREATE TRIGGER destinos_de_envio_sincronizar_setores AFTER INSERT OR DELETE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.destino_sincronizar_setores_do_contato();

-- Excluir o Contato pelo Setor dono, com outro Setor ainda o usando como Destino: ele não é apagado. Passa
-- a ser da URA (sem dono: só o Admin o edita) e segue disponível aos Setores que o escolheram; os Destinos
-- do ex-dono saem. Sem uso de outro Setor, o Contato cai com os Destinos do dono. Contato da URA (ou do Admin)
-- em uso por algum Setor não se exclui: não há quem o herde.
CREATE FUNCTION public.contato_exclusao_em_uso() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_setores text;
begin
  -- Apagar o Cliente leva os Contatos em cascata: aí não há o que decidir.
  if not exists (select 1 from public.clientes where id = old.cliente_id) then
    return old;
  end if;
  select string_agg(distinct s.rotulo, ', ' order by s.rotulo) into v_setores
  from public.destinos_de_envio d
  join public.setores_de_contato s on s.slug = d.setor::text
  where d.contato_id = old.id and d.setor is distinct from old.dono_setor;
  if v_setores is null then
    return old;
  end if;
  if old.dono_setor is null then
    raise exception 'O contato "%" está em uso por: %.', old.nome, v_setores using errcode = '23503';
  end if;
  perform set_config('app.contato_herdado_pela_ura', old.id::text, true);
  update public.cliente_contatos set dono_setor = null where id = old.id;
  perform set_config('app.contato_herdado_pela_ura', '', true);
  delete from public.destinos_de_envio where contato_id = old.id and setor = old.dono_setor;
  delete from public.cliente_contato_setores where contato_id = old.id and setor = old.dono_setor::text;
  -- Cancela a exclusão: o Contato fica, agora da URA.
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.contato_exclusao_em_uso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contato_exclusao_em_uso() TO service_role;
CREATE TRIGGER cliente_contatos_exclusao_em_uso BEFORE DELETE ON public.cliente_contatos
    FOR EACH ROW EXECUTE FUNCTION public.contato_exclusao_em_uso();

ALTER TABLE public.destinos_de_envio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.destinos_de_envio FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.destinos_de_envio TO authenticated;
GRANT ALL ON TABLE public.destinos_de_envio TO service_role;

-- Cada Setor lê e grava só os seus Destinos (Líder do Setor, Responsável do Cliente no Setor e Admin).
CREATE POLICY destinos_de_envio_select ON public.destinos_de_envio FOR SELECT TO authenticated
    USING (public.meu_papel() = 'admin'
           OR (public.pode_ver_cliente(cliente_id) AND public.meu_setor() = setor));
CREATE POLICY destinos_de_envio_insert ON public.destinos_de_envio FOR INSERT TO authenticated
    WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY destinos_de_envio_update ON public.destinos_de_envio FOR UPDATE TO authenticated
    USING (public.pode_gerir_parcelamento(cliente_id, setor))
    WITH CHECK (public.pode_gerir_parcelamento(cliente_id, setor));
CREATE POLICY destinos_de_envio_delete ON public.destinos_de_envio FOR DELETE TO authenticated
    USING (public.pode_gerir_parcelamento(cliente_id, setor));

CREATE TRIGGER destinos_de_envio_auditar AFTER INSERT OR UPDATE OR DELETE ON public.destinos_de_envio
    FOR EACH ROW EXECUTE FUNCTION public.auditar_cadastro_operacional_editado();

-- Quem recebe este envio: os Destinos do Setor para o tipo e, sem nenhum para o tipo, os "todos". Um tipo
-- pode ter vários Contatos. `valido` é falso quando o canal gravado no Destino sumiu do Contato
-- (`motivo` diz qual); quem consome entrega só os válidos e reporta os inválidos. O tipo (específico ou
-- "todos") é escolhido antes; `p_canal` só filtra depois, então um tipo definido só por e-mail não deixa
-- os "todos" entrarem numa consulta de WhatsApp. `telefone_envio` já vem com o DDI 55.
CREATE FUNCTION public.destinos_de_envio_resolvidos(p_cliente_id uuid, p_setor public.setor_slug, p_tipo text, p_canal text DEFAULT NULL)
    RETURNS TABLE(destino_id uuid, tipo text, contato_id uuid, contato_nome text, canal public.forma_envio,
                  telefone_envio text, email text, valido boolean, motivo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with candidatos as (
    select d.*, c.nome, c.telefone, c.email as contato_email
    from public.destinos_de_envio d
    join public.cliente_contatos c on c.id = d.contato_id
    where d.cliente_id = p_cliente_id and d.setor = p_setor
  ),
  escolhidos as (
    select * from candidatos where tipo = p_tipo
    union all
    select * from candidatos
    where tipo is null and not exists (select 1 from candidatos where tipo = p_tipo)
  )
  select e.id, e.tipo, e.contato_id, e.nome, e.canal,
         case when length(public.chave_telefone(e.telefone)) in (10, 11)
              then '55' || public.chave_telefone(e.telefone)
              else public.chave_telefone(e.telefone) end,
         e.contato_email,
         not (e.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(e.telefone) is null)
           and not (e.canal in ('email', 'whatsapp_e_email') and e.contato_email is null),
         case when e.canal in ('whatsapp', 'whatsapp_e_email') and public.chave_telefone(e.telefone) is null
              then 'sem_whatsapp'
              when e.canal in ('email', 'whatsapp_e_email') and e.contato_email is null
              then 'sem_email' end
  from escolhidos e
  where p_canal is null
     or e.canal = p_canal::public.forma_envio
     or e.canal = 'whatsapp_e_email'
  order by e.criado_em, e.id;
$$;
REVOKE ALL ON FUNCTION public.destinos_de_envio_resolvidos(uuid, public.setor_slug, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destinos_de_envio_resolvidos(uuid, public.setor_slug, text, text) TO authenticated, service_role;

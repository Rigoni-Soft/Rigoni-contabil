-- Avisos de cadastro (#142): uma linha por destinatário, gerada por gatilho (SECURITY DEFINER) quando
-- nasce o Cadastro operacional SN ("novo cliente") ou quando uma alteração contratual é anexada
-- ("nova alteração"). O destinatário é resolvido na hora do fato e não muda depois. Fora de
-- `registros_auditoria`: criar o aviso e marcá-lo visto não são ações de auditoria.
CREATE TABLE public.avisos_cadastro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destinatario_id uuid NOT NULL,
    tipo text NOT NULL,
    cliente_id uuid NOT NULL,
    alteracao_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    visto_em timestamp with time zone,
    CONSTRAINT avisos_cadastro_pkey PRIMARY KEY (id),
    CONSTRAINT avisos_cadastro_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES public.perfis(id) ON DELETE CASCADE,
    CONSTRAINT avisos_cadastro_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE,
    CONSTRAINT avisos_cadastro_alteracao_id_fkey FOREIGN KEY (alteracao_id) REFERENCES public.cliente_alteracoes_contratuais(id) ON DELETE CASCADE
);

-- Contador de não vistos.
CREATE INDEX avisos_cadastro_nao_vistos_idx ON public.avisos_cadastro USING btree (destinatario_id) WHERE (visto_em IS NULL);

ALTER TABLE public.avisos_cadastro ENABLE ROW LEVEL SECURITY;

-- Só lê os próprios. Sem policy de escrita: INSERT/UPDATE/DELETE só pelos gatilhos e pela RPC.
CREATE POLICY avisos_cadastro_select_proprio ON public.avisos_cadastro FOR SELECT TO authenticated USING (destinatario_id = auth.uid());

revoke all on table public.avisos_cadastro from anon, authenticated;
grant select on table public.avisos_cadastro to authenticated;
grant all on table public.avisos_cadastro to service_role;

-- Líder ativo do Setor SN (no máximo um: `perfis_um_lider_ativo_por_setor`); sem Líder, sem aviso e
-- sem fallback para o Admin.
CREATE FUNCTION public.avisar_novo_cliente_sn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id)
  select p.id, 'novo_cliente', new.cliente_id
    from public.perfis p
   where p.setor = 'simples_nacional' and p.papel = 'lider_setor' and p.desativado_em is null;
  return null;
end;
$$;

CREATE TRIGGER cliente_cadastro_operacional_avisar_novo AFTER INSERT ON public.cliente_cadastro_operacional_sn FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_cliente_sn();

revoke all on function public.avisar_novo_cliente_sn() from public, anon, authenticated;
grant execute on function public.avisar_novo_cliente_sn() to service_role;

-- Líder ativo + Responsável não desativado (`union` dedupa a mesma pessoa). Só avisa se o Cliente já
-- tem Cadastro operacional SN: na criação do Cliente (`criar_cliente`) as alterações entram antes
-- dele, então só o aviso de "novo cliente" nasce.
CREATE FUNCTION public.avisar_nova_alteracao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id, alteracao_id)
  select d.id, 'nova_alteracao', new.cliente_id, new.id
    from (
      select p.id from public.perfis p
       where p.setor = 'simples_nacional' and p.papel = 'lider_setor' and p.desativado_em is null
      union
      select p.id from public.cliente_cadastro_operacional_sn c
        join public.perfis p on p.id = c.responsavel_id
       where c.cliente_id = new.cliente_id and p.desativado_em is null
    ) d
   where exists (select 1 from public.cliente_cadastro_operacional_sn where cliente_id = new.cliente_id);
  return null;
end;
$$;

CREATE TRIGGER cliente_alteracoes_avisar_nova AFTER INSERT ON public.cliente_alteracoes_contratuais FOR EACH ROW EXECUTE FUNCTION public.avisar_nova_alteracao();

revoke all on function public.avisar_nova_alteracao() from public, anon, authenticated;
grant execute on function public.avisar_nova_alteracao() to service_role;

-- Marca o próprio aviso como visto; idempotente (mantém o primeiro `visto_em`) e sem efeito no aviso
-- de outra pessoa. É a única escrita do destinatário (S3a: sem UPDATE direto).
CREATE FUNCTION public.marcar_aviso_visto(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.avisos_cadastro
     set visto_em = now()
   where id = p_id and destinatario_id = auth.uid() and visto_em is null;
$$;

-- Lista paginada por cursor (visto, criado_em, id): não vistos primeiro, depois do mais novo para o
-- mais antigo. SECURITY INVOKER: a RLS limita às linhas do próprio usuário.
CREATE FUNCTION public.listar_avisos_cadastro(p_limite integer DEFAULT 30, p_cursor_visto boolean DEFAULT NULL, p_cursor_criado_em timestamp with time zone DEFAULT NULL, p_cursor_id uuid DEFAULT NULL)
    RETURNS SETOF public.avisos_cadastro
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select a.*
    from public.avisos_cadastro a
   where p_cursor_id is null
      or (a.visto_em is not null) > p_cursor_visto
      or ((a.visto_em is not null) = p_cursor_visto
          and (a.criado_em < p_cursor_criado_em or (a.criado_em = p_cursor_criado_em and a.id < p_cursor_id)))
   order by (a.visto_em is not null), a.criado_em desc, a.id desc
   limit p_limite;
$$;

revoke all on function public.marcar_aviso_visto(uuid) from public, anon;
grant execute on function public.marcar_aviso_visto(uuid) to authenticated, service_role;
revoke all on function public.listar_avisos_cadastro(integer, boolean, timestamp with time zone, uuid) from public, anon;
grant execute on function public.listar_avisos_cadastro(integer, boolean, timestamp with time zone, uuid) to authenticated, service_role;

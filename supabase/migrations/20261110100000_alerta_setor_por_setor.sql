-- O alerta passa a ser do Setor dono do Parcelamento: a chave do alerta aberto vira Cliente, tipo,
-- origem e Setor. Os alertas que já existem ficam no Setor em que foram gravados (o Simples Nacional).
DROP INDEX public.alertas_setor_um_aberto_por_cliente_tipo_e_origem;
CREATE UNIQUE INDEX alertas_setor_um_aberto_por_cliente_tipo_origem_e_setor
  ON public.alertas_setor USING btree (cliente_id, tipo, origem, setor) WHERE (resolvido_em IS NULL);

CREATE OR REPLACE FUNCTION public.registrar_alerta_setor(p_setor public.setor_slug, p_tipo public.tipo_alerta_setor, p_cliente_id uuid, p_mensagem text, p_origem text DEFAULT 'lembretes'::text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into public.alertas_setor (setor, tipo, cliente_id, mensagem, origem)
  values (p_setor, p_tipo, p_cliente_id, p_mensagem, p_origem)
  on conflict (cliente_id, tipo, origem, setor) where resolvido_em is null
  do update set mensagem = excluded.mensagem, criado_em = now();
$$;

-- As pendências de guia PGFN dizem de qual Setor é cada Parcelamento.
CREATE OR REPLACE FUNCTION public.pendencias_guia_pgfn(p_cliente_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
                    'codigo', p.codigo,
                    'setor', p.setor,
                    'estado', case when g.parcelamento_id is null then 'sem_guia' else 'a_confirmar' end
                  ) order by p.setor, p.codigo), '[]'::jsonb)
    from public.cliente_parcelamentos p
    left join public.cliente_parcelamento_guias g
      on g.parcelamento_id = p.id
     and g.competencia = to_char(public.mes_corrente_sp(), 'YYYYMM')
   where p.cliente_id = p_cliente_id
     and p.origem = 'pgfn' and p.situacao = 'em_aberto' and p.parcelas_restantes > 0
     and g.estado is distinct from 'confirmada';
$$;

-- Confirmar a guia resolve só o alerta do Setor do Parcelamento, e só quando esse Setor ficou sem
-- pendência: o alerta de outro Setor do mesmo Cliente segue aberto.
CREATE OR REPLACE FUNCTION public.resolver_alerta_guia_pgfn_confirmada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cliente_id uuid;
  v_setor public.setor_slug;
begin
  select p.cliente_id, p.setor into v_cliente_id, v_setor
    from public.cliente_parcelamentos p where p.id = new.parcelamento_id;

  if not exists (
    select 1 from jsonb_array_elements(public.pendencias_guia_pgfn(v_cliente_id)) as pendencia
     where pendencia ->> 'setor' = v_setor::text
  ) then
    update public.alertas_setor
       set resolvido_em = now()
     where cliente_id = v_cliente_id and setor = v_setor and origem = 'lembrete_pgfn'
       and resolvido_em is null;
  end if;
  return null;
end;
$$;

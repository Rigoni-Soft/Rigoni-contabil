-- Os envios automáticos (lembrete de documento, DAS e guias de parcelamento) passam a ler os Destinos de
-- envio do Setor (ADR 0013) em vez do Contato mais antigo e da forma de envio do Cliente. As leituras
-- dos jobs deixam de devolver contato, e-mail e forma de envio: quem recebe vem de
-- `destinos_de_envio_do_job`, que é `destinos_de_envio_resolvidos` com a janela de 24h de cada telefone.

-- A forma de envio do cadastro e o contato "provisório" saem das leituras dos jobs.
DROP FUNCTION public.clientes_para_lembrete(uuid, integer);
DROP FUNCTION public.clientes_para_parcelamento(uuid, integer);
DROP FUNCTION public.clientes_para_envio_base();

CREATE FUNCTION public.clientes_para_envio_base() RETURNS TABLE(cliente_id uuid, empresa text, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.id, c.empresa, o.documento_obrigatorio, o.das_status, o.data_envio_das
  from public.cliente_cadastro_operacional_sn o
  join public.clientes c on c.id = o.cliente_id;
$$;

CREATE FUNCTION public.clientes_para_lembrete(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text, documento_obrigatorio public.documento_obrigatorio_status, das_status public.das_status, data_envio_das date)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.*
    from public.clientes_para_envio_base() b
   where p_apos is null or b.cliente_id > p_apos
   order by b.cliente_id
   limit p_limite;
$$;

CREATE FUNCTION public.clientes_para_parcelamento(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500) RETURNS TABLE(cliente_id uuid, empresa text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select b.cliente_id, b.empresa
    from public.clientes_para_envio_base() b
   where public.cliente_tem_parcelamento_pendente(b.cliente_id)
     and (p_apos is null or b.cliente_id > p_apos)
   order by b.cliente_id
   limit p_limite;
$$;

-- O baseline concede EXECUTE a authenticated por default privileges: o REVOKE de PUBLIC não basta, e
-- estas funções são só do job (service_role).
REVOKE ALL ON FUNCTION public.clientes_para_envio_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.clientes_para_envio_base() TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_lembrete(uuid, integer) TO service_role;
GRANT ALL ON FUNCTION public.clientes_para_parcelamento(uuid, integer) TO service_role;

-- Quem recebe o envio (os válidos e os inválidos, com o `motivo`: quem consome entrega os válidos e
-- reporta os inválidos), com o telefone já com o DDI e a última Mensagem que o
-- Contato mandou em qualquer Atendimento do telefone (abre e fecha a janela de 24h).
CREATE FUNCTION public.destinos_de_envio_do_job(p_cliente_id uuid, p_setor public.setor_slug, p_tipo text)
    RETURNS TABLE(contato_nome text, telefone_envio text, email text, canal public.forma_envio,
                  ultima_mensagem_do_contato_em timestamp with time zone, valido boolean, motivo text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select r.contato_nome, r.telefone_envio, r.email, r.canal,
         (select max(m.criado_em)
            from public.mensagens m
            join public.atendimentos a on a.id = m.atendimento_id
           where a.chave_telefone = public.chave_telefone(r.telefone_envio) and m.autor = 'contato'),
         r.valido, r.motivo
    from public.destinos_de_envio_resolvidos(p_cliente_id, p_setor, p_tipo) r;
$$;
REVOKE ALL ON FUNCTION public.destinos_de_envio_do_job(uuid, public.setor_slug, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.destinos_de_envio_do_job(uuid, public.setor_slug, text) TO service_role;

-- O aviso do sino leva o texto do alerta que o gerou (o de "novo cliente" e o de "nova alteração" montam o
-- texto no cliente a partir do tipo).
ALTER TABLE public.avisos_cadastro ADD COLUMN mensagem text;

-- Um alerta `contato_ausente` que se ABRE (inserção: renovar o que já está aberto é um UPDATE e não
-- avisa de novo) avisa no sino o Líder do Setor e o Responsável do Cliente naquele Setor; sem
-- Responsável ativo, só o Líder. O Admin nunca é destinatário. Resolvido e reaberto, é uma nova
-- inserção e um novo aviso.
CREATE FUNCTION public.avisar_cliente_sem_meio_de_envio() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id, mensagem)
  select d.id, 'sem_meio_de_envio', new.cliente_id, new.mensagem
    from (
      select p.id from public.perfis p
       where p.setor = new.setor and p.papel = 'lider_setor' and p.desativado_em is null
      union
      select p.id from public.cliente_responsaveis r
        join public.perfis p on p.id = r.responsavel_id
       where r.cliente_id = new.cliente_id and r.setor = new.setor and p.desativado_em is null
    ) d;
  return null;
end;
$$;
REVOKE ALL ON FUNCTION public.avisar_cliente_sem_meio_de_envio() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.avisar_cliente_sem_meio_de_envio() TO service_role;
CREATE TRIGGER alertas_setor_avisar_sem_meio_de_envio AFTER INSERT ON public.alertas_setor
    FOR EACH ROW WHEN (new.tipo = 'contato_ausente') EXECUTE FUNCTION public.avisar_cliente_sem_meio_de_envio();

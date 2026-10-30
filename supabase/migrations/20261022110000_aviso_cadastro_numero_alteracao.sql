-- O aviso de nova alteração passa a levar o nº da alteração (#144): quem o recebe (Líder e
-- Responsável) não lê `cliente_alteracoes_contratuais` (RLS só do Admin), então o destino do aviso
-- não poderia apontar a alteração sem o nº gravado aqui. Nasce junto com o aviso, como o destinatário.
ALTER TABLE public.avisos_cadastro ADD COLUMN alteracao_numero integer;

UPDATE public.avisos_cadastro a
   SET alteracao_numero = c.numero
  FROM public.cliente_alteracoes_contratuais c
 WHERE c.id = a.alteracao_id;

CREATE OR REPLACE FUNCTION public.avisar_nova_alteracao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.avisos_cadastro (destinatario_id, tipo, cliente_id, alteracao_id, alteracao_numero)
  select d.id, 'nova_alteracao', new.cliente_id, new.id, new.numero
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

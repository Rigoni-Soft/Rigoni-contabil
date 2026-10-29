-- Encerramento automático: o Atendimento em atendimento se encerra 23h50 depois da última
-- Mensagem do cliente (a do Funcionário não adia), com o sistema como ator, também fora do
-- expediente. Substitui por completo a Inatividade (2h, avisos e encerramento pela URA): saem as
-- RPCs, o gatilho que protegia o aviso e as colunas de aviso e de reentrega da mensagem final.

drop trigger atendimento_em_aviso_nao_muda_de_dono on public.atendimentos;
drop function public.atendimento_em_aviso_nao_muda_de_dono();

drop function public.atendimentos_para_inatividade();
drop function public.marcar_aviso_inatividade(uuid, public.autor_mensagem, timestamp with time zone);
drop function public.confirmar_aviso_entregue(uuid);
drop function public.confirmar_encerramento_entregue(uuid, uuid);
drop function public.liberar_encerramento_pendente(uuid, uuid);
drop function public.reivindicar_encerramentos_pendentes(integer, interval, interval, interval);
drop function public.encerrar_atendimento_por_inatividade(uuid, uuid, uuid, public.setor_slug, text);

-- Derruba junto os checks e o índice parcial que dependiam delas.
alter table public.atendimentos
  drop column aviso_inatividade_em,
  drop column aviso_inatividade_de,
  drop column aviso_entregue_em,
  drop column encerramento_pendente,
  drop column encerramento_reivindicado_em,
  drop column encerramento_reivindicacao,
  drop column encerramento_tentativa_em,
  drop column encerramento_tentativas;

-- Encerra, como o encerramento comum (mesma auditoria, no Setor do Atendimento), os Atendimentos
-- com Funcionário cuja última Mensagem do cliente é de `p_corte` ou anterior. Atendimento sem
-- Mensagem do cliente conta desde que foi aberto. Na espera (sem Funcionário) não entra.
-- Devolve quantos encerrou.
create function public.encerrar_atendimentos_por_silencio(p_corte timestamp with time zone, p_ator uuid)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v_atendimento record;
  v_encerrados integer := 0;
begin
  for v_atendimento in
    select a.id, a.setor, a.funcionario_id
    from public.atendimentos a
    where a.status = 'em_andamento' and a.funcionario_id is not null
      and coalesce(
        (select max(m.criado_em) from public.mensagens m
          where m.atendimento_id = a.id and m.autor = 'contato'),
        a.criado_em
      ) <= p_corte
    order by a.id
  loop
    if public.encerrar_atendimento(
         v_atendimento.id, v_atendimento.funcionario_id, p_ator, v_atendimento.setor
       ) ->> 'status' = 'encerrado' then
      v_encerrados := v_encerrados + 1;
    end if;
  end loop;
  return v_encerrados;
end;
$$;

revoke all on function public.encerrar_atendimentos_por_silencio(timestamp with time zone, uuid) from public, anon;
grant execute on function public.encerrar_atendimentos_por_silencio(timestamp with time zone, uuid) to service_role;

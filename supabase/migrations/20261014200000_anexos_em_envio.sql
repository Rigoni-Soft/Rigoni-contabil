-- Devolutiva da PR #85, R85-03: finalizar de novo um upload já consumido por uma Mensagem podia
-- apagar o arquivo do histórico (a compensação de uma segunda tentativa que falha remove o caminho
-- recebido). Aqui o objeto subido em partes tem posse e consumo idempotentes: quem reserva o caminho
-- antes de validar é o dono daquela tentativa; a reserva de quem concluiu fica (consumo), e a de
-- quem falhou é liberada junto da remoção do objeto.
create table public.anexos_em_envio (
  caminho text primary key,
  atendimento_id uuid not null references public.atendimentos (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Só o service_role (docs/adr/0001): nenhum perfil lê nem escreve a reserva.
alter table public.anexos_em_envio enable row level security;
revoke all on table public.anexos_em_envio from anon, authenticated;

-- 'reservado': esta tentativa é dona do objeto. 'em_uso': outra finalização (em andamento ou
-- concluída) já o reservou, ou uma Mensagem do histórico já o referencia. Quem recebe 'em_uso'
-- recusa SEM remover o objeto: ele não é seu.
create function public.reservar_anexo_para_envio(p_caminho text, p_atendimento_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.mensagens
    where anexo_caminho = p_caminho or anexo_miniatura_caminho = p_caminho
  ) then
    return 'em_uso';
  end if;
  insert into public.anexos_em_envio (caminho, atendimento_id)
  values (p_caminho, p_atendimento_id)
  on conflict (caminho) do nothing;
  if not found then
    return 'em_uso';
  end if;
  return 'reservado';
end;
$$;

-- A tentativa falhou e removeu o objeto: a reserva sai junto, o caminho volta a não existir.
create function public.liberar_anexo_em_envio(p_caminho text)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.anexos_em_envio where caminho = p_caminho;
$$;

revoke all on function
  public.reservar_anexo_para_envio(text, uuid),
  public.liberar_anexo_em_envio(text)
  from public, anon, authenticated;
grant execute on function
  public.reservar_anexo_para_envio(text, uuid),
  public.liberar_anexo_em_envio(text)
  to service_role;

-- Devolutiva técnica PR #60, ajuste 04: alinha o enum public.setor_slug (#28,
-- já mergeado em develop) com a verdade de domínio (shared/kernel/setores.ts,
-- decisão confirmada em 28/09/2026) — remove 'contabil_externo' e 'ti', que
-- nunca foram setores próprios de fato e nunca são aceitos pelo validador da
-- aplicação. Nenhum dado existente usa esses valores (nem seed.sql, nem
-- nenhuma migration) — seguro remover sem estratégia de saneamento de linhas.
--
-- Postgres não tem "ALTER TYPE ... DROP VALUE" (drop de enum não é suportado):
-- a técnica padrão é recriar o tipo sem os valores mortos e migrar as colunas.

-- 1) A policy "perfis_select_mesmo_setor", a função meu_setor() e a função
--    registrar_acao_auditoria (#29/PR #60) dependem do tipo antigo — precisam
--    ser derrubadas antes de trocar o tipo, e recriadas depois.
drop policy "perfis_select_mesmo_setor" on public.perfis;
drop function public.meu_setor();
drop function public.registrar_acao_auditoria(uuid, public.setor_slug, text, text, public.resultado_acao);

alter type public.setor_slug rename to setor_slug_antigo;

create type public.setor_slug as enum (
  'rh',
  'tributario',
  'simples_nacional',
  'contabil',
  'societario',
  'condominios',
  'financeiro',
  'administrativo',
  'recepcao'
);

alter table public.perfis
  alter column setor type public.setor_slug using setor::text::public.setor_slug;

alter table public.registros_auditoria
  alter column setor type public.setor_slug using setor::text::public.setor_slug;

drop type public.setor_slug_antigo;

create or replace function public.meu_setor()
returns public.setor_slug
language sql
security definer
stable
set search_path = public
as $$
  select setor from public.perfis where id = auth.uid();
$$;

create policy "perfis_select_mesmo_setor"
  on public.perfis for select
  using (setor = public.meu_setor());

create or replace function public.registrar_acao_auditoria(
  p_id uuid,
  p_setor public.setor_slug,
  p_acao text,
  p_alvo text,
  p_resultado public.resultado_acao
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  insert into public.registros_auditoria (id, ator, setor, acao, alvo, resultado, criado_em)
  values (p_id, auth.uid(), p_setor, p_acao, p_alvo, p_resultado, now());
end;
$$;

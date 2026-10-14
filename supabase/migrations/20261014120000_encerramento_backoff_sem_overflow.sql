-- #73 (revalidação 4 da PR #83): o backoff da reivindicação da mensagem final multiplicava a base
-- por 2^(tentativas - 1) antes de aplicar o teto. A partir de 39 tentativas (base de 1 minuto) o
-- produto estoura o intervalo ("interval out of range") dentro do filtro, e um único registro com
-- muitas falhas abortava a RPC inteira e a reentrega dos demais.
-- Agora o expoente é limitado ao que já alcança o teto, antes da multiplicação: o produto nunca
-- passa de 2 × teto, para qualquer base e teto. Mesma assinatura, rodízio, lease, token e lotes.
create or replace function public.reivindicar_encerramentos_pendentes(
  p_limite int,
  p_lease interval default interval '10 minutes',
  p_backoff_base interval default interval '1 minute',
  p_backoff_teto interval default interval '6 hours'
)
returns table (id uuid, telefone text, texto text, reivindicacao uuid)
language sql
security invoker
set search_path = public
as $$
  with alvo as (
    select a.id from public.atendimentos a
    where a.status = 'encerrado' and a.encerramento_pendente
      and (a.encerramento_reivindicado_em is null
           or a.encerramento_reivindicado_em < clock_timestamp() - p_lease)
      and (a.encerramento_tentativa_em is null
           or a.encerramento_tentativa_em < clock_timestamp() - least(
                p_backoff_base * power(2, least(
                  greatest(a.encerramento_tentativas - 1, 0),
                  -- Expoente que já alcança o teto: acima dele o produto só cresceria até estourar
                  -- o intervalo (39 tentativas com a base de 1 min), e o `least` chegaria tarde.
                  greatest(ceil(log(2,
                    greatest(extract(epoch from p_backoff_teto), 1)
                    / greatest(extract(epoch from p_backoff_base), 0.000001)))::int, 0))),
                p_backoff_teto))
    order by a.encerramento_tentativa_em nulls first, a.id
    limit p_limite
    for update skip locked
  ),
  reivindicado as (
    update public.atendimentos a
    set encerramento_reivindicado_em = clock_timestamp(),
        encerramento_reivindicacao = gen_random_uuid(),
        encerramento_tentativa_em = clock_timestamp(),
        encerramento_tentativas = a.encerramento_tentativas + 1
    from alvo
    where a.id = alvo.id
    returning a.id, a.telefone, a.encerramento_reivindicacao
  )
  select r.id, r.telefone, (
    select m.texto from public.mensagens m
    where m.atendimento_id = r.id and m.autor = 'ura'
    order by m.criado_em desc, m.id desc
    limit 1
  ), r.encerramento_reivindicacao
  from reivindicado r
  order by r.id;
$$;
revoke all on function public.reivindicar_encerramentos_pendentes(int, interval, interval, interval)
  from public, anon, authenticated;

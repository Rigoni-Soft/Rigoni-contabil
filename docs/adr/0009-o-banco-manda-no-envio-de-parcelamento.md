# ADR 0009 — O banco manda no envio de parcelamento, e o envio é registrado por parcela

**Status:** aceita (2026-10-23) — ticket #126

## Contexto

O job de parcelamento (#53) decidia por Cliente: tinha "parcelamento pendente"? Então buscava uma
guia no provedor fiscal e, ao concluir, marcava o Cliente como enviado. Com vários Parcelamentos por
Cliente (#122) e o provedor entregando as guias por CNPJ, sem dizer de qual Parcelamento é cada uma
(#123), a decisão passa a ser por Parcelamento e por parcela, e cada emissão do provedor é cobrada.

## Decisão

- **O banco manda.** Quem decide se há guia a enviar é o estado gravado: Parcelamento em aberto, com
  parcelas restantes (comum ou interno, nunca PGFN) e sem registro de envio do mês. Sem isso o provedor fiscal não é
  chamado. O provedor nunca diz que o Parcelamento acabou: `quitado` no provedor com o Parcelamento
  em aberto aqui não o quita, vira alerta `parcelamento_sem_guia` (divergência é decisão humana).
- **O registro de envio é a unidade do envio.** `registrar_envio_parcelamento` grava a parcela,
  desconta uma restante e quita ao zerar numa transação, só na primeira vez (idempotente). O status
  do mês deriva dele, então o reset mensal é automático.
- **Gravado guia a guia, depois do aceite.** Uma queda entre o aceite e o registro reenvia a guia na
  rodada seguinte (pelo menos uma vez); registrar sem entregar nunca acontece.
- **Atribuição falha fechado e um núcleo para os dois gatilhos** (job e URA): o passo a passo está em
  `docs/deploy/parcelamento-cron.md`.

## Consequências

- Os alertas `parcelamento_sem_guia` e `financeiro_ausente` entram em `tipo_alerta_setor` (o segundo é
  usado quando há Parcelamento interno pendente e `FINANCEIRO_TELEFONE` está ausente ou inválido).
- A atribuição por valor é inferência não confirmada contra o Serpro real: ligar primeiro para um CNPJ
  em produção.
- A guia fica em `guias-fiscais` por cliente/parcelamento/AAAAMM, o mesmo caminho a cada tentativa.

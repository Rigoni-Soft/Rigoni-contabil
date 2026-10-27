# Job de lembretes PGFN (#187): ativação e operação

Rota: `GET|POST /api/jobs/lembretes-pgfn`, agendada em `vercel.json` (`0 11 1,10,15 * *`, 08h em São
Paulo). O próprio job confere o dia no fuso de São Paulo e não faz nada fora de 01/10/15, que são
fixos e valem também em fim de semana. É independente do job de [lembretes](./lembretes-cron.md)
(DAS e documento): rota, agenda, flag e origem de alerta próprias.

## Gate de ativação

`CRON_SECRET` autentica, mas só `LEMBRETES_PGFN_AUTOMATICOS=ligada` autoriza executar (desligada
responde `200 { "ativa": false }`, sem ler nem alterar nada). O job não fala com o Cliente: não exige
mensageria nem e-mail real.

## O que o job faz

Para cada Cliente com Parcelamento PGFN em aberto (inclusive interno) sem guia **confirmada** da
competência do mês, abre um alerta `guia_pgfn_pendente` ao setor Simples Nacional (`alertas_setor`,
`origem = 'lembrete_pgfn'`, um aberto por Cliente).

- O texto separa **Falta anexar** (nenhuma guia do mês) de **A confirmar** (anexada, não confirmada) e
  lista o código de cada Parcelamento pendente.
- Competência atrasada sem guia não alerta: só a do mês corrente conta.
- Rodar de novo renova a mensagem e a data. O alerta se resolve sozinho na rodada seguinte à entrada
  da guia confirmada do mês (ou ao Parcelamento sair de aberto): o Cliente volta na leitura sem
  pendência e o que não foi renovado é resolvido, só dos Clientes reavaliados.
- Sem canal externo e sem roteamento por pessoa: a RLS de `alertas_setor` mostra ao Responsável os
  Clientes dele e ao Líder todos.
- Cada job resolve só os alertas da própria origem: não interfere nos do DAS/documento nem nos do
  envio de parcelamento.
- **Resposta:** `500` com o resumo quando `falhas > 0` (alerta que não gravou ou não resolveu).

## Variáveis

| Variável | Valor | Efeito |
| --- | --- | --- |
| `CRON_SECRET` | segredo do agendador | autentica a chamada |
| `LEMBRETES_PGFN_AUTOMATICOS` | `desligada` (padrão) \| `ligada` | autoriza executar |

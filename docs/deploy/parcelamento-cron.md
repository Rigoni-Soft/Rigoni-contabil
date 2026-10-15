# Job de envio da guia de parcelamento (#53): ativação e operação

Rota: `GET|POST /api/jobs/parcelamento`, agendada em `vercel.json` (`0 11 20,22,24,26,28 * *`, 08h
em São Paulo). O próprio job confere o dia no fuso de São Paulo e não faz nada fora de
20/22/24/26/28.

## Gate de ativação

Igual ao job de lembrete ([lembretes-cron.md](./lembretes-cron.md)): mesma flag
`LEMBRETES_AUTOMATICOS=ligada`, mesmo `CRON_SECRET`, e em produção exige `MENSAGERIA_MODO=real`.
Os pré-requisitos de ligar (mensageria real, e-mail real, template `envio_guia_parcelamento`
aprovado) são os mesmos.

## O que o job faz

Para cada Cliente com tem parcelamento positivo e Parcelamento = pendente: reivindica o
Parcelamento (pendente → enviado, atômico, auditado com a URA como `cliente.enviar-parcelamento-automatico`),
busca a guia no provedor fiscal, publica o PDF e entrega pela forma de envio do Cliente (WhatsApp
e/ou e-mail, mesma entrega do DAS).

- **Retentativa:** falha do provedor fiscal, do armazenamento ou do envio é repetida até 3 vezes
  antes de virar alerta `falha_envio`. Cada rodada seguinte (dias 22, 24, 26, 28) tenta de novo.
- **Falha:** o Parcelamento volta a pendente (`cliente.desfazer-envio-parcelamento-automatico`).
- **Alertas:** `alertas_setor` com `origem = 'parcelamento'`. Cada job renova e resolve só os
  alertas da própria origem, então a rodada do parcelamento não fecha o `das_pendente` do lembrete.
- **Parcela no template:** a parcela do provedor (`AAAAMM`) vai como `MM/AAAA`. Guia sem parcela
  falha em vez de sair com a variável vazia.
- **Resposta:** `500` com o resumo quando `falhas > 0`.

## Limites conhecidos

- Não há campo de data de envio do Parcelamento (o DAS tem); a auditoria da URA registra quando.
- Mesmo limite do lembrete: processo que cai entre reivindicar e entregar deixa o Parcelamento
  `enviado` sem a guia ter saído.

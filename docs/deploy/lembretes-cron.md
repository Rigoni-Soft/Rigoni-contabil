# Job de lembrete de documento e envio de DAS (#52): ativação e operação

Rota: `GET|POST /api/jobs/lembretes`, agendada em `vercel.json` (`0 11 1,5,10,15 * *`, 08h em São
Paulo). O próprio job confere o dia no fuso de São Paulo e não faz nada fora de 01/05/10/15.

## Gate de ativação

Mesma regra da inatividade ([inatividade-cron.md](./inatividade-cron.md)): `CRON_SECRET` autentica,
mas só `LEMBRETES_AUTOMATICOS=ligada` autoriza executar (desligada responde
`200 { "ativa": false }`). Em `NODE_ENV=production` exige também `MENSAGERIA_MODO=real`: com o
adapter falso o DAS ficaria `enviado` sem o cliente ter recebido.

Antes de ligar em produção:

1. Mensageria real no ar (#68) e os 3 templates aprovados na Meta (#67).
2. E-mail real (hoje só o adapter falso `EnvioEmailFalsoGateway`) e o endereço no cadastro do
   Contato: ainda não existe campo de e-mail, então a forma de envio com e-mail vira alerta
   `contato_ausente` em vez de enviar.
3. Painel do Funcionário lendo `alertas_setor` (a tabela e a RLS já existem; a tela não).

## O que o job faz

| Situação do Cliente                            | Ação                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Documento obrigatório = negativo               | Lembrete ao contato padrão (template fora da janela de 24h, formato próprio dentro)    |
| DAS = pronto                                   | Busca a guia, envia pela forma de envio, marca DAS = enviado com a data de envio       |
| DAS = pendente e documento obrigatório = positivo | Alerta `das_pendente` ao setor Simples Nacional                                     |

- **Retentativa:** falha do Serpro, do armazenamento ou do envio (`ServicoExternoError`) é repetida
  até 3 vezes (2 s entre elas) antes de virar alerta `falha_envio`. Sem autorização vigente ou
  destinatário inválido não repete.
- **Forma de envio:** WhatsApp e e-mail são independentes; o DAS vira `enviado` se ao menos um canal
  entregou. Canal que falha ou não tem destinatário gera alerta e não derruba o outro.
- **Guia no template:** o PDF vai para o bucket privado `guias-fiscais` e o provedor busca por link
  assinado (7 dias). Os PDFs não são removidos (ver `ponytail:` no gateway).
- **Alertas:** `alertas_setor`, um aberto por Cliente e tipo (índice parcial); o job não empilha o
  mesmo aviso nas quatro rodadas do mês. Quem resolve preenche `resolvido_em`.
- **Auditoria:** DAS marcado como enviado grava `cliente.enviar-das-automatico` com a URA como ator.
- **Resposta:** `500` com o resumo quando `falhas > 0`, para a rodada aparecer nos logs do cron.

## Limites conhecidos

- Duas invocações simultâneas no mesmo dia podem reenviar a mesma guia (o DAS só vira `enviado`
  depois da entrega). O cron roda uma vez por dia; reivindicar a linha antes de enviar se preciso.
- Parcelamento (dias 20/22/24/26/28) fica fora desta issue (história 43 da spec #24) e não está neste job.

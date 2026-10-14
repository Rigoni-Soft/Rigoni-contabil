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
2. E-mail real. Hoje só existe o adapter falso, e em produção o canal e-mail falha de forma
   explícita (`EnvioEmailIndisponivelGateway`): o DAS não é marcado como enviado e o setor recebe
   alerta, em vez de o adapter falso responder ok. O destino é `clientes.email`,
   informado pelo Admin no cadastro do Cliente (opcional) e exposto na projeção `clientes_basico`.
   Cliente sem e-mail com forma de envio que o inclui vira alerta `contato_ausente`. Editar o e-mail
   depois do cadastro ainda não tem tela (só o Admin cria; o cadastro operacional não o altera).
3. Painel do Funcionário lendo `alertas_setor` (a tabela e a RLS já existem; a tela não).

## O que o job faz

| Situação do Cliente                            | Ação                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Documento obrigatório = negativo               | Lembrete ao contato padrão (template fora da janela de 24h, formato próprio dentro)    |
| DAS = pronto                                   | Busca a guia, envia pela forma de envio, marca DAS = enviado com a data de envio       |
| DAS = pendente e documento obrigatório = positivo | Alerta `das_pendente` ao setor Simples Nacional                                     |

- **Retentativa:** falha do Serpro, do armazenamento ou do envio (`ServicoExternoError`) é repetida
  até 3 vezes (2 s entre elas) antes de virar alerta `falha_envio`. Cada envio repete sozinho: o
  texto que já chegou não sai de novo quando só o documento falhou. Sem autorização vigente ou
  destinatário inválido não repete.
- **Reivindicação do DAS:** antes de buscar e enviar, o DAS é reivindicado (pronto → enviado, atômico,
  auditado com a URA). Quem não reivindicou (outro job ou o Funcionário) não envia; entrega que falha
  devolve o DAS a pronto com a data de envio anterior (`cliente.desfazer-envio-das-automatico`).
- **Forma de envio:** WhatsApp e e-mail são independentes; o DAS vira `enviado` se ao menos um
  canal entregou. Canal que falha ou não tem destinatário gera alerta e não derruba o outro. Quando
  a guia do DAS tem os dois canais na forma de envio e só um entregou, abre-se também
  `entrega_parcial` (no lembrete não: ele volta a sair na próxima rodada): o job
  não a resolve sozinho (o DAS já saiu de `pronto`), ela fica aberta até alguém reenviar pelo
  outro canal.
- **Guia no template:** o PDF vai para o bucket privado `guias-fiscais` e o provedor busca por link
  assinado (7 dias). Os PDFs não são removidos (ver `ponytail:` no gateway).
- **Alertas:** `alertas_setor`, um aberto por Cliente e tipo (índice parcial). Repetir o alerta
  renova a mensagem e a data; ao fim da rodada o que não foi renovado é resolvido (o Cliente
  regularizou). O mesmo problema não alerta duas vezes na rodada (lembrete + DAS do mesmo Cliente).
- **Auditoria:** DAS marcado como enviado grava `cliente.enviar-das-automatico` com a URA como ator.
- **Resposta:** `500` com o resumo quando `falhas > 0`, para a rodada aparecer nos logs do cron.

## Limites conhecidos

- Processo que cai entre reivindicar e entregar deixa o DAS como `enviado` sem a guia ter saído; a
  auditoria da URA mostra o que aconteceu. Lease com retomada se isso virar problema.
- Os clientes são processados em sequência dentro de uma invocação: com volume alto, medir a
  duração e declarar `maxDuration` (depende do plano Vercel) ou processar em lotes.
- Parcelamento (dias 20/22/24/26/28) fica fora desta issue (história 43 da spec #24) e não está
  neste job.

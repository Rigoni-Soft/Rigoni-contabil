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
- **Reserva do envio do DAS (R87-01):** antes de buscar e enviar, o job reserva a entrega
  (`reservar_envio_automatico`, tabela `envios_automaticos`: um token por Cliente e tipo, validade
  de 15 min). A reserva **não muda o DAS**: ele só vira `enviado` (com a data, auditado com a URA)
  ao concluir, depois de a entrega ser aceita, e só com o token da reserva. Quem não reservou (outro
  job, tentativa vigente ou o Funcionário) não envia; entrega que falha libera a reserva e o DAS
  segue `pronto`. Queda no meio deixa o DAS como estava e a reserva expira: a rodada seguinte
  retoma. Conclusão ou liberação com token antigo não têm efeito (a tentativa mais recente não é
  sobrescrita).
- **Forma de envio:** WhatsApp e e-mail são independentes; o DAS vira `enviado` se ao menos um
  canal entregou. Canal que falha ou não tem destinatário gera alerta e não derruba o outro. Quando
  a guia do DAS tem os dois canais na forma de envio e só um entregou, abre-se também
  `entrega_parcial` (no lembrete não: ele volta a sair na próxima rodada): o job
  não a resolve sozinho (o DAS já saiu de `pronto`), ela fica aberta até alguém reenviar pelo
  outro canal.
- **Guia no template:** o PDF vai para o bucket privado `guias-fiscais` e o provedor busca por link
  assinado (7 dias). Os PDFs não são removidos (ver `ponytail:` no gateway).
- **Leitura completa (R87-03):** os Clientes vêm em páginas de 500 por cursor (`cliente_id`),
  abaixo do `max_rows` do PostgREST. A leitura é completa ou erro: página que falha não vira rodada
  parcial.
- **Janela de 24h (R87-04):** consultada pela chave **nacional** do telefone (DDD + número, a que o
  recebimento grava em `atendimentos.chave_telefone`); o telefone de envio vai com o DDI 55.
- **Alertas:** `alertas_setor`, um aberto por Cliente e tipo (índice parcial). Repetir o alerta
  renova a mensagem e a data; ao fim da rodada o que não foi renovado é resolvido (o Cliente
  regularizou), **só para os Clientes que a rodada reavaliou** (`p_cliente_ids`). Cliente cuja
  tarefa está com a reserva ocupada por outra tentativa vigente (resultado ainda incerto) não é
  reavaliado: fica de fora da resolução, inclusive os alertas da tarefa vizinha, e a rodada seguinte
  decide. O mesmo problema não alerta duas vezes na rodada (lembrete + DAS do mesmo Cliente).
- **Auditoria:** DAS marcado como enviado grava `cliente.enviar-das-automatico` com a URA como ator.
- **Resposta:** `500` com o resumo quando `falhas > 0`, para a rodada aparecer nos logs do cron.

## Limites conhecidos

- Entrega pelo menos uma vez: se o provedor aceitou e o processo caiu antes de concluir, a reserva
  expira e a rodada seguinte reenvia a guia (o provedor não garante exatamente-uma-vez). Sem
  reconciliação automática nem painel de reservas vencidas: observar `envios_automaticos` com
  `concluido_em is null` antes de operar em produção.
- Os clientes são processados em sequência dentro de uma invocação (a leitura é paginada, mas o
  processamento não tem orçamento de duração): com volume alto, medir a duração e declarar
  `maxDuration` (depende do plano Vercel) ou processar em lotes com progresso durável.
  O mesmo vale para o job de [parcelamento](./parcelamento-cron.md), que roda nos dias 20 a 28.
- A guia de parcelamento (dias 20/22/24/26/28) é outro job: [parcelamento-cron.md](./parcelamento-cron.md).

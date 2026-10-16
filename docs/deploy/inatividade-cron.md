# Job de inatividade (#73): ativação e operação

Rota: `GET|POST /api/jobs/inatividade`, agendada em `vercel.json` (`0 11 * * *`, 1 vez por dia, 08h em São Paulo).

> **Hobby:** o cron é diário porque o Hobby rejeita o deploy com frequência maior. O desenho do job
> (aviso, espera, encerramento) assume rodadas de 5 min: com 1 rodada/dia a inatividade só age uma
> vez por dia. Antes de ligar `INATIVIDADE_AUTOMATICA` em produção, subir para o Pro e voltar a
> `*/5 * * * *`.

## Gate de ativação

Autenticar (`Authorization: Bearer $CRON_SECRET`) **não** autoriza executar. O job só lê e altera
Atendimentos com `INATIVIDADE_AUTOMATICA=ligada`; desligada (padrão), a rota responde
`200 { "ativa": false }` sem tocar no banco. Em `NODE_ENV=production` ela também exige
`MENSAGERIA_MODO=real`: com o adapter falso o job marcaria e encerraria Atendimentos reais sem que
o cliente recebesse o aviso.

Antes de ligar em produção:

1. Mensageria real no ar (#68) e templates aprovados (#67).
2. O aviso ao Funcionário visível no painel (parte pendente do #73): hoje é só `aviso_inatividade_*`
   no banco.
3. QA do fluxo completo (aviso, cancelamento por resposta, encerramento, reenvio do pendente).

## Plano Vercel e custo (I1)

- Cron de 5 minutos são até 288 invocações/dia. O plano **Hobby** limita crons a uma execução por
  dia e rejeita esta expressão no deploy; Pro/Enterprise aceitam a frequência de 1 minuto. Confirmar
  o plano do projeto antes de fazer deploy com este `vercel.json`.
- `atendimentos_para_inatividade` agrega as Mensagens de todos os Atendimentos em andamento com
  Funcionário: medir a duração com volume real; se pesar, filtrar por vencimento no banco.
- O endpoint responde `500` com o resumo no corpo quando `falhas > 0` (rodada falha aparece nos
  logs do cron); ligar alerta também em `reentregues` (mensagens finais que não tinham chegado) e
  acompanhar o backlog de pendentes.
- O Vercel Cron **não** reexecuta nem garante execução única: duas invocações podem se sobrepor,
  o que as garantias abaixo cobrem no banco.

## Garantias do job

- **Aviso reservado antes de sair:** `marcar_aviso_inatividade` só marca se não entrou Mensagem
  depois do que o job leu e sob lock da linha; só quem marcou envia. Envio que falha desfaz a marca.
- **Sem encerrar sem aviso:** `encerrar_atendimento_por_inatividade` exige `aviso_entregue_em`.
- **Resposta × encerramento:** o anexo de Mensagem e o encerramento travam a linha do Atendimento;
  a resposta que chega primeiro cancela, e a que chega depois não é anexada ao encerrado.
- **Histórico durável:** a mensagem final da URA entra no histórico na transação que fecha;
  `encerramento_pendente` guarda a entrega, e o job reenvia mesmo com o Atendimento encerrado.
- **Reenvio exclusivo:** a mensagem final pendente é *reivindicada*
  (`reivindicar_encerramentos_pendentes`, `for update skip locked` + lease de 10 min em
  `encerramento_reivindicado_em`); dois jobs simultâneos não enviam a mesma. Envio que falha
  libera a reivindicação; job que cai a deixa vencer o lease. Quem encerra já nasce com a
  reivindicação.
- **Posse (revalidação 3):** a reivindicação emite um token (`encerramento_reivindicacao`);
  `liberar_encerramento_pendente` e `confirmar_encerramento_entregue` o exigem. Um job cujo lease
  venceu não altera a reivindicação de quem a retomou (confirmar devolve `false`). Gate para ativar
  a mensageria real, junto da idempotência externa (#68).
- **Rodízio e backoff (revalidação 3):** a ordem é nunca tentadas primeiro, depois a tentativa mais
  antiga (`encerramento_tentativa_em`); quem falha vai para o fim da fila. Depois de cada tentativa a
  mensagem só volta a ser elegível passado `1 min × 2^(tentativas − 1)`, até o teto de 6 h: um
  destinatário que falha sempre não monopoliza os lotes nem repete a cada rodada de 5 min. Sem
  desistência automática: a mensagem final nunca some em silêncio, e as falhas aparecem no resumo
  do job (HTTP 500).
- **Backlog em lotes:** cada rodada reivindica até 50 pendentes (`LOTE_REENTREGA`); o resto entra
  nas próximas rodadas (sem teto de 1.000 do PostgREST, sem perda).
- **Limite conhecido:** se o provedor aceitar a mensagem e a confirmação no banco falhar, o envio
  se repete depois do lease. Exatamente-uma-vez externo depende da idempotência do adapter real
  (#68), pré-requisito de ativação junto de métricas de tentativas/falhas/pendentes.

# Job de inatividade (#73): ativação e operação

Rota: `GET|POST /api/jobs/inatividade`, agendada em `vercel.json` (`*/5 * * * *`).

## Gate de ativação (devolutiva da PR #83, B1)

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
- O endpoint responde `200` com falhas individuais no corpo (`falhas > 0`): ligar alerta na
  contagem de `falhas` e de `reentregues` (mensagens finais que não tinham chegado).

## Garantias do job

- **Aviso reservado antes de sair:** `marcar_aviso_inatividade` só marca se não entrou Mensagem
  depois do que o job leu e sob lock da linha; só quem marcou envia. Envio que falha desfaz a marca.
- **Sem encerrar sem aviso:** `encerrar_atendimento_por_inatividade` exige `aviso_entregue_em`.
- **Resposta × encerramento:** o anexo de Mensagem e o encerramento travam a linha do Atendimento;
  a resposta que chega primeiro cancela, e a que chega depois não é anexada ao encerrado.
- **Histórico durável:** a mensagem final da URA entra no histórico na transação que fecha;
  `encerramento_pendente` guarda a entrega, e o job reenvia mesmo com o Atendimento encerrado.

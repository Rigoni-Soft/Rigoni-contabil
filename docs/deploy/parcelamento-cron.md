# Job de envio da guia de parcelamento (#53, #126)

Mesmo gate, retentativa, reserva da entrega e alertas do job de lembrete/DAS
([lembretes-cron.md](./lembretes-cron.md)); só mudam:

| | Lembrete/DAS (#52) | Parcelamento (#53) |
| --- | --- | --- |
| Rota | `/api/jobs/lembretes` | `/api/jobs/parcelamento` |
| Dias (São Paulo, 08h) | 01/05/10/15 | 20/22/24/26/28 |
| Cliente | DAS pronto | ao menos um Parcelamento em aberto, não interno, sem registro de envio do mês |
| Reserva → conclusão | reserva; DAS pronto → enviado ao concluir | reserva do Cliente; o registro de envio é gravado guia a guia (a reserva só é fechada ao concluir; sem guia aceita é liberada) |
| Auditoria (ator URA) | `cliente.enviar-das-automatico` | `cliente.enviar-parcelamento-automatico` |

- Mesma flag `LEMBRETES_AUTOMATICOS=ligada` e mesmos pré-requisitos (mensageria real, e-mail real,
  template `envio_guia_parcelamento` aprovado).
- `alertas_setor.origem = 'parcelamento'`: cada job renova e resolve só os seus alertas.
- A parcela do provedor (`AAAAMM`) vai como `MM/AAAA`; guia sem parcela não é atribuída a ninguém.
- Não há data de envio do Parcelamento (o DAS tem): o registro de envio e a auditoria dizem quando.

## Regra única (#126)

O núcleo `EnviarGuiasParcelamento` (job e URA) segue, por Cliente:

1. **O banco manda.** Lê os Parcelamentos em aberto com parcelas restantes (`registrar_envio_parcelamento`
   recusa o resto). Sem nenhum pendente (interno ou já com registro do mês) o provedor não é chamado.
2. **Uma consulta por CNPJ**, com `ignorar` = parcelas que todos os comuns já receberam (cada emissão é
   cobrada). O provedor devolve 0..n guias e não diz de qual Parcelamento é cada uma.
3. **Atribuição** (`atribuirGuiasParcelamento`): com um Parcelamento em aberto, todas vão a ele; com vários,
   cada guia vai ao de valor guardado mais próximo sem passar do valor dela (a atrasada pode vir com juros),
   e um Parcelamento nunca recebe duas da mesma parcela. Empate de valor é arbitrário. Guia sem candidato
   fica de fora (falha fechado). Guia que cabe a um Parcelamento interno não vai ao Cliente. Nova emissão
   de uma parcela que o dono já recebeu (o `ignorar` só pula as que todos receberam) é descartada, não
   vai a outro Parcelamento. Guias de parcelas atrasadas entram como as do mês: cada uma é entregue,
   registrada e desconta uma parcela restante; "pendente" é só não ter registro da parcela do mês.
4. **Entrega e registro por guia.** A guia é guardada em `guias-fiscais` em `cliente/parcelamento/AAAAMM`,
   entregue, e só então `registrar_envio_parcelamento` grava o registro, desconta uma parcela restante (uma
   vez por parcela; repetir devolve `false`) e quita ao zerar, auditado com a URA. A falha de uma guia não
   trava as outras.
5. **Alertas.** `falha_envio` (provedor, entrega ou registro) e `parcelamento_sem_guia` (Parcelamento
   pendente sem guia; a mensagem lista os códigos), de origem `parcelamento`, renovados e resolvidos só
   por este job.

- A migration `20261023110000` cria `registrar_envio_parcelamento`, reduz
  `concluir_envio_automatico_parcelamento` a fechar a reserva e acrescenta `parcelamento_sem_guia` e
  `financeiro_ausente` a `tipo_alerta_setor`. Aplicar junto com o código desta versão.
- A atribuição por valor é inferência (a guia atrasada pode vir corrigida) que dev e homolog não
  validam, porque usam o adapter falso e a API de teste. Por isso falha fechado: o pior caso é nenhuma
  guia e um alerta `parcelamento_sem_guia`. Ligar primeiro para um CNPJ em produção.
- `quitado` do provedor com o Parcelamento em aberto não tem sinal no contrato por CNPJ (a lista vazia é o
  que o provedor devolve): vira `parcelamento_sem_guia` e o Parcelamento segue em aberto.
- A migration `20261016090000` substitui as RPCs `registrar_alerta_setor` e
  `resolver_alertas_setor_nao_renovados` do #52 (parâmetros `p_origem` e `p_cliente_ids`) e
  recria o índice único de `alertas_setor`. Aplicar junto com o código desta versão: o código do #52
  anterior chama as assinaturas antigas, que deixam de existir.
- A reserva reutiliza `reservar_envio_automatico`/`liberar_envio_automatico` do #52 (tipo
  `parcelamento`); a conclusão (`concluir_envio_automatico_parcelamento`) só fecha a reserva. Leitura em páginas de
  500 por cursor (`cliente_id`), estável mesmo quando o próprio job tira Clientes do conjunto.
- O status do mês deriva do registro de envio e volta a pendente sozinho no mês seguinte (reset mensal automático).

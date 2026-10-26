# Job de envio da guia de parcelamento (#53, #126)

Mesmo gate, retentativa, reserva da entrega e alertas do job de lembrete/DAS
([lembretes-cron.md](./lembretes-cron.md)); só mudam:

| | Lembrete/DAS (#52) | Parcelamento (#53) |
| --- | --- | --- |
| Rota | `/api/jobs/lembretes` | `/api/jobs/parcelamento` |
| Dias (São Paulo, 08h) | 01/05/10/15 | 20/22/24/26/28 |
| Cliente | DAS pronto | ao menos um Parcelamento em aberto (comum ou interno) sem registro de envio do mês |
| Reserva → conclusão | reserva; DAS pronto → enviado ao concluir | reserva do Cliente; o registro de envio é gravado guia a guia (a reserva só é fechada ao concluir; sem guia aceita é liberada) |
| Auditoria (ator URA) | `cliente.enviar-das-automatico` | `cliente.enviar-parcelamento-automatico` |

- Mesma flag `LEMBRETES_AUTOMATICOS=ligada` e mesmos pré-requisitos (mensageria real, e-mail real,
  templates `envio_guia_parcelamento` e `envio_guia_parcelamento_interno` aprovados).
- `alertas_setor.origem = 'parcelamento'`: cada job renova e resolve só os seus alertas.
- A parcela do provedor (`AAAAMM`) vai como `MM/AAAA`; guia sem parcela não é atribuída a ninguém.
- Não há data de envio do Parcelamento (o DAS tem): o registro de envio e a auditoria dizem quando.

## Regra única (#126)

O núcleo `EnviarGuiasParcelamento` (o job hoje; a URA passa a usá-lo no #128) segue, por Cliente.
Até o #128 a opção de parcelamento da URA continua pelo caminho legado (`GuiasFiscaisGateway.buscar`,
a guia mais atrasada do CNPJ, sem consultar os acordos): ele não separa interno de comum e não tem
cobertura de WhatsApp real. Passos do núcleo:

1. **O banco manda.** Lê os Parcelamentos em aberto com parcelas restantes (`registrar_envio_parcelamento`
   recusa o resto). Sem nenhum pendente (todos já com registro do mês, ou sem destino: ver Parcelamento interno) o provedor não é chamado.
2. **Uma consulta por CNPJ**, com `ignorar` = parcelas que todos os Parcelamentos com destino já receberam (cada emissão é
   cobrada). O provedor devolve 0..n guias e não diz de qual Parcelamento é cada uma.
3. **Atribuição** (`atribuirGuiasParcelamento`): com um Parcelamento em aberto, todas vão a ele; com vários,
   cada guia só vai ao único cujo valor guardado não passa do valor dela (a atrasada pode vir com juros),
   e um Parcelamento nunca recebe duas da mesma parcela. O valor não prova a quem a guia pertence, então
   falha fechado: guia sem candidato, ou com mais de um candidato compatível (mesmo de valores diferentes), fica de fora, proteção provisória até o provedor devolver o acordo da guia; a reemissão de uma guia já entregue (mesma identidade,
   `parcela:valor` enquanto o provedor não devolver o número do documento, gravada em
   `cliente_parcelamento_envios.identidade` e lida de qualquer acordo do Cliente, inclusive quitado) é
   descartada; e com mais de um compatível nada é atribuído, ainda que só alguns já tenham recebido a parcela (não se
   sabe se é a reemissão de um ou a guia de outro). Quem ficou sem guia vira `parcelamento_sem_guia`, para
   conferência. A atribuição vê todos os em aberto: a guia de um Parcelamento sem destino não cai em outro.
   Nova emissão de uma parcela que o dono já recebeu (o `ignorar` só pula as que todos receberam) é
   descartada, não vai a outro Parcelamento. Guias de parcelas atrasadas entram como as do mês: cada uma é entregue,
   registrada e desconta uma parcela restante; "pendente" é só não ter registro da parcela do mês.
4. **Entrega e registro por guia.** A guia é guardada em `guias-fiscais` em `cliente/parcelamento/AAAAMM`,
   entregue, e só então `registrar_envio_parcelamento` grava o registro, desconta uma parcela restante (uma
   vez por parcela) e quita ao zerar, auditado com a URA. Devolve `registrado`, `ja_registrado` (repetir)
   ou `nao_elegivel` (acordo quitado ou removido durante a rodada: entregue sem registro vira `falha_envio`).
   Sem saldo para a guia (o acordo quitou na rodada) ela não é entregue e vira `falha_envio`. A falha de uma
   guia não trava as outras. A guia republicada na retentativa não apaga a anterior no Storage (caminho
   estável por acordo e parcela).
5. **Alertas.** `falha_envio` (provedor, entrega ou registro) e `parcelamento_sem_guia` (Parcelamento
   pendente sem guia; a mensagem lista os códigos), de origem `parcelamento`, renovados e resolvidos só
   por este job.

- A migration `20261024108000` (numerada depois das do F3 do PR #191, para atualizar um banco já migrado)
  cria `registrar_envio_parcelamento`, a coluna `identidade` dos envios, reduz
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

## Parcelamento interno (#127)

O interno vai sempre e só ao WhatsApp do financeiro (`FINANCEIRO_TELEFONE`, só dígitos com DDI), por
template `envio_guia_parcelamento_interno`, qualquer que seja a forma de envio do Cliente; nunca ao Cliente.

- Telefone ausente ou inválido não derruba o app: o interno não é enviado, segue pendente e abre
  `financeiro_ausente` até configurar. Definir no Production.
- A migration `20261024110000` faz o interno contar em `cliente_tem_parcelamento_pendente`. Aplicar junto
  com o código desta versão.

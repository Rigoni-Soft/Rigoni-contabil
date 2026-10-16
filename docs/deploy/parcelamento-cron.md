# Job de envio da guia de parcelamento (#53)

Mesmo gate, retentativa, reserva da entrega e alertas do job de lembrete/DAS
([lembretes-cron.md](./lembretes-cron.md)); só mudam:

| | Lembrete/DAS (#52) | Parcelamento (#53) |
| --- | --- | --- |
| Rota | `/api/jobs/lembretes` | `/api/jobs/parcelamento` |
| Dias (São Paulo, 08h) | 01/05/10/15 | 20/22/24/26/28 |
| Cliente | DAS pronto | tem parcelamento positivo e Parcelamento pendente |
| Reserva → conclusão | reserva; DAS pronto → enviado ao concluir | reserva; Parcelamento pendente → enviado ao concluir (segue pendente se a entrega falha) |
| Auditoria (ator URA) | `cliente.enviar-das-automatico` | `cliente.enviar-parcelamento-automatico` |

- Mesma flag `LEMBRETES_AUTOMATICOS=ligada` e mesmos pré-requisitos (mensageria real, e-mail real,
  template `envio_guia_parcelamento` aprovado).
- `alertas_setor.origem = 'parcelamento'`: cada job renova e resolve só os seus alertas.
- A parcela do provedor (`AAAAMM`) vai como `MM/AAAA`; guia sem parcela falha.
- Não há data de envio do Parcelamento (o DAS tem): a auditoria registra quando.
- A migration `20261016090000` substitui as RPCs `registrar_alerta_setor` e
  `resolver_alertas_setor_nao_renovados` do #52 (parâmetros `p_origem` e `p_cliente_ids`) e
  recria o índice único de `alertas_setor`. Aplicar junto com o código desta versão: o código do #52
  anterior chama as assinaturas antigas, que deixam de existir.
- A reserva reutiliza `reservar_envio_automatico`/`liberar_envio_automatico` do #52 (tipo
  `parcelamento`); a conclusão é `concluir_envio_automatico_parcelamento`. Leitura em páginas de
  500 por cursor (`cliente_id`), estável mesmo quando o próprio job tira Clientes do conjunto.
- O Parcelamento `enviado` não volta a `pendente` sozinho: quem repõe é o Funcionário (como o DAS).

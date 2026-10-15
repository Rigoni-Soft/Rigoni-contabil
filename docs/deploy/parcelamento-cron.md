# Job de envio da guia de parcelamento (#53)

Mesmo gate, retentativa, reivindicação e alertas do job de lembrete/DAS
([lembretes-cron.md](./lembretes-cron.md)); só mudam:

| | Lembrete/DAS (#52) | Parcelamento (#53) |
| --- | --- | --- |
| Rota | `/api/jobs/lembretes` | `/api/jobs/parcelamento` |
| Dias (São Paulo, 08h) | 01/05/10/15 | 20/22/24/26/28 |
| Cliente | DAS pronto | tem parcelamento positivo e Parcelamento pendente |
| Reivindicação | DAS pronto → enviado | Parcelamento pendente → enviado (volta a pendente se a entrega falha) |
| Auditoria (ator URA) | `cliente.enviar-das-automatico` | `cliente.enviar-parcelamento-automatico` |

- Mesma flag `LEMBRETES_AUTOMATICOS=ligada` e mesmos pré-requisitos (mensageria real, e-mail real,
  template `envio_guia_parcelamento` aprovado).
- `alertas_setor.origem = 'parcelamento'`: cada job renova e resolve só os seus alertas.
- A parcela do provedor (`AAAAMM`) vai como `MM/AAAA`; guia sem parcela falha.
- Não há data de envio do Parcelamento (o DAS tem): a auditoria registra quando.
- A migration `20261016090000` substitui as RPCs `registrar_alerta_setor` e
  `resolver_alertas_setor_nao_renovados` do #52 (novo parâmetro `p_origem`, default `lembretes`) e
  recria o índice único de `alertas_setor`. Aplicar junto com o código desta versão: o código do #52
  anterior chama as assinaturas antigas, que deixam de existir.
- O Parcelamento `enviado` não volta a `pendente` sozinho: quem repõe é o Funcionário (como o DAS).

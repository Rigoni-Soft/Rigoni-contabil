# Contrato: obrigações fiscais do Cliente

Contrato **neutro** que o sistema espera de qualquer fonte de DAS, guia de parcelamento e CND. Nenhum
termo de provedor aparece aqui: o Serpro (ver `docs/pesquisa/serpro-api.md`) é só um dos adapters
possíveis (#66), traduzido pra este formato. Em desenvolvimento quem responde é `mock-api/` (`yarn mock:api`).

Configuração: `OBRIGACOES_FISCAIS_URL` (padrão `http://127.0.0.1:4010`). Porta no código:
`ObrigacoesFiscaisPort`; adapter: `ObrigacoesFiscaisHttpGateway`. A CND tem porta própria: `CertidaoCndPort` / `CertidaoCndHttpGateway`.

`{cnpj}` = 14 caracteres `[0-9A-Z]` (CNPJ numérico ou alfanumérico), sem máscara. Datas `AAAA-MM-DD`; valores em centavos; PDFs em base64.

| Recurso | Resposta 200 |
|---|---|
| `GET /clientes/{cnpj}/autorizacao` | `{ "vigente": true, "dataExpiracao": "2027-12-31" }` ou `{ "vigente": false }` |
| `GET /clientes/{cnpj}/das` | `{ nomeArquivo, pdfBase64, competencia "AAAA-MM", valorCentavos, vencimento }` |
| `GET /clientes/{cnpj}/parcelamentos?ignorar=AAAAMM,...` | `{ "guias": [{ nomeArquivo, pdfBase64, parcela "AAAAMM", valorCentavos?, vencimento? }] }`: 0, 1 ou várias, uma por parcela (ver abaixo) |
| `GET /clientes/{cnpj}/cnd` | `{ nomeArquivo, pdfBase64, validade }` |

Qualquer resposta não-2xx, timeout (10 s) ou corpo fora deste formato vira `ServicoExternoError`
no sistema — falha esperada, nunca derruba o restante.

## Guias de parcelamento do CNPJ (#123)

`GET /clientes/{cnpj}/parcelamentos` devolve **todas as guias que o provedor emite hoje para o CNPJ**, uma por parcela (atrasadas e a vencer): zero, uma ou várias. Substitui o antigo `GET /clientes/{cnpj}/parcelamento` (uma guia só), que não existe mais em nenhum lugar (porta, mock, adapters).

- **Só parcelamentos com `origem = receita_federal`.** `pgfn` nunca chega ao provedor fiscal (a guia dela é o PDF anexado pelo escritório): quem chama (job e URA) filtra por `origem` antes; porta e mock não conhecem a PGFN. O regime do Cliente escolhe o parcelamento do provedor (Simples Nacional ou MEI), só o ordinário.
- **O provedor não diz de qual parcelamento do Cliente é cada guia.** Quem chama **atribui depois de baixar**, cada guia ao parcelamento e ao CNPJ dela (por exemplo, pelo `valorCentavos` contra o `valor_parcela_centavos` guardado e pela parcela), e **roteia o parcelamento marcado como interno ao financeiro**, nunca ao Cliente. O `codigo` do parcelamento é rótulo nosso (`PARC-XXXXXXXX` quando o Recibo não traz código) e não vai ao provedor.
- **`?ignorar=`**: parcelas (AAAAMM, separadas por vírgula) já entregues. O provedor não as emite de novo, porque cada emissão é cobrada.
- **Sem guias não é erro**: `{ "guias": [] }` (sem parcelamento ativo, sem saldo devedor, nada emitível). Indisponibilidade (rede, timeout, 5xx, corpo fora do contrato) é `ServicoExternoError`, que o consumidor repete. Sem autorização vigente, o adapter real devolve `ForbiddenError` (o contrato HTTP/mock não modela autorização aqui).
- `valorCentavos` é opcional no contrato, mas o adapter Serpro o preenche (vem da lista de parcelas).

## Adapter real (Serpro, #66)

`OBRIGACOES_FISCAIS_MODO=serpro` troca o mock pelo `ObrigacoesFiscaisSerproGateway` (Integra Contador). Trial no Preview e
produção com e-CNPJ no Production, por `SERPRO_AMBIENTE`: variáveis e guarda do certificado em `docs/deploy/serpro.md`. Traduções: DAS = PGDASD/GERARDAS12 do **mês anterior**; parcelamento = o parcelamento **ordinário** do regime do Cliente (PARCSN para Simples Nacional, PARCMEI para MEI; PERT e RELP estão fechados a novas adesões), uma guia por parcela emitível
(atrasadas e a vencer), só PDF e valor (sem vencimento): **1 consulta** (`PARCELASPARAGERAR162`/`202`, lista parcela e valor) e **1 emissão por parcela** (`GERARDAS161`/`201`, que só aceita `parcelaParaEmitir`), sem as de `?ignorar=` e **sem pré-consulta de autorização**. Mensagens do Serpro: `ER_E001`, `ER_N003` e `ER_N008` (nada a emitir) e 204/404 = lista vazia; `ER_N005`/`ER_N006` (a parcela não sai agora) = só aquela parcela fica de fora. Queda no meio devolve as guias já baixadas (as outras vêm na rodada seguinte); sem nenhuma, a autorização (Integra-Procurações) é consultada uma vez só para classificar: vencida = `ForbiddenError`, senão indisponibilidade. A consulta do MEI (`PARCELASPARAGERAR202`) e o formato real de `listaParcela` e de `mensagens[].codigo` ficam a confirmar no CNPJ real; autorização = Integra-Procurações (vigente se alguma procuração não venceu).
A **CND** é porta separada (`CertidaoCndPort`, `CND_MODO`, 3 variáveis `SERPRO_CND_*`): produto avulso "Consulta CND", token próprio sem certificado, consulta repetida com a `Chave` enquanto o status for 7. O endpoint de produção (`consulta-cnd/v1/certidao`) foi inferido do exemplo de trial: confirmar no Swagger com o contrato ativo.

## Mock

`POST /__modo` com `{"modo": "normal" | "falha" | "sem_autorizacao" | "sem_parcelas"}` troca o cenário:
`falha` responde 503 em tudo; `sem_autorizacao` devolve `vigente: false`; no normal as guias de parcelamento são 2 (atrasada + do mês), `sem_parcelas` nenhuma.

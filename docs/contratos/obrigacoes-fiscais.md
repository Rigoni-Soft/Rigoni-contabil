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
| `GET /clientes/{cnpj}/parcelamentos/{codigo}` | `{ nomeArquivo, pdfBase64, parcela "AAAAMM", valorCentavos?, vencimento? }` (uma guia por parcelamento; ver abaixo) |
| `GET /clientes/{cnpj}/cnd` | `{ nomeArquivo, pdfBase64, validade }` |

Qualquer resposta não-2xx, timeout (10 s) ou corpo fora deste formato vira `ServicoExternoError`
no sistema — falha esperada, nunca derruba o restante.

## Guia por código de parcelamento (#123)

`GET /clientes/{cnpj}/parcelamentos/{codigo}` **substitui** o antigo `GET /clientes/{cnpj}/parcelamento`, que não existe mais em nenhum lugar (porta, mock, adapters). `{codigo}` vai codificado na URL.

- **Só parcelamentos com `origem = receita_federal`.** `pgfn` nunca chega ao provedor fiscal (a guia dela é o PDF anexado pelo escritório): quem chama (job e URA) filtra por `origem` antes; porta e mock não conhecem a PGFN.
- **O `codigo` é o rótulo do parcelamento no nosso sistema**, não um número que o provedor conheça: o Recibo de Adesão do Simples não imprime código, então o sistema gera `PARC-XXXXXXXX`. A emissão continua valendo com código gerado.
- **Recusa tipada**: `422` com `{ "motivo": "codigo_desconhecido" | "quitado" | "fora_do_periodo" | "ambiguo" }`, que vira `GuiaParcelamentoIndisponivelError` com o `motivo`. Indisponibilidade (rede, timeout, 5xx, corpo fora do contrato) segue `ServicoExternoError`, que o consumidor repete. Sem autorização vigente, o adapter real devolve `ForbiddenError` (o contrato HTTP/mock não modela autorização na guia por código).
- **Nunca a "guia que vier".** `ambiguo` quando o Cliente tem mais de um parcelamento da Receita em aberto e a guia não se atribui a um só. O banco sabe quantos são; o consumidor informa na porta (`emAbertoDaReceita`, fora da URL do contrato).
- `valorCentavos` é opcional: se vier, o consumidor pode compará-lo ao `valor_parcela_centavos` guardado (fora do escopo desta porta).

## Adapter real (Serpro, #66)

`OBRIGACOES_FISCAIS_MODO=serpro` troca o mock pelo `ObrigacoesFiscaisSerproGateway` (Integra Contador). Trial no Preview e
produção com e-CNPJ no Production, por `SERPRO_AMBIENTE`: variáveis e guarda do certificado em `docs/deploy/serpro.md`. Traduções: DAS = PGDASD/GERARDAS12 do **mês anterior**; parcelamento = o parcelamento **ordinário** do regime do Cliente (PARCSN para Simples Nacional, PARCMEI para MEI; PERT e RELP estão fechados a novas adesões), na parcela do
**mês corrente**, só PDF (sem valor/vencimento), pedido **direto, sem pré-consulta de autorização**: a emissão só aceita `parcelaParaEmitir` (AAAAMM), não escolhe o parcelamento (`docs/pesquisa/serpro-guia-parcelamento.md`), então o `codigo` não vai ao Serpro e, com mais de um parcelamento da Receita em aberto, o adapter responde `ambiguo` sem gastar a chamada. Mensagens do Serpro viram motivo: `ER_E001` (sem parcelamento ativo, e 204/404) = `codigo_desconhecido`; `ER_N003` (sem saldo devedor) = `quitado`; `ER_N005`/`ER_N006`/`ER_N008` (parcela indisponível) = `fora_do_periodo`. Qualquer outra falha consulta a autorização (Integra-Procurações) uma vez só para classificar: vencida = `ForbiddenError`, senão indisponibilidade. O formato real das mensagens (`mensagens[].codigo`) e a atribuição com vários parcelamentos ficam a confirmar no CNPJ real; autorização = Integra-Procurações (vigente se alguma procuração não venceu).
A **CND** é porta separada (`CertidaoCndPort`, `CND_MODO`, 3 variáveis `SERPRO_CND_*`): produto avulso "Consulta CND", token próprio sem certificado, consulta repetida com a `Chave` enquanto o status for 7. O endpoint de produção (`consulta-cnd/v1/certidao`) foi inferido do exemplo de trial: confirmar no Swagger com o contrato ativo.

## Mock

`POST /__modo` com `{"modo": "normal" | "falha" | "sem_autorizacao" | "codigo_desconhecido" | "quitado" | "fora_do_periodo" | "ambiguo"}` troca o cenário:
`falha` responde 503 em tudo; `sem_autorizacao` devolve `vigente: false`; cada modo por motivo recusa só a guia por código (`422 { motivo }`).

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
| `GET /clientes/{cnpj}/parcelamento` | `{ nomeArquivo, pdfBase64, parcela "AAAAMM", valorCentavos?, vencimento? }` |
| `GET /clientes/{cnpj}/cnd` | `{ nomeArquivo, pdfBase64, validade }` |

Qualquer resposta não-2xx, timeout (10 s) ou corpo fora deste formato vira `ServicoExternoError`
no sistema — falha esperada, nunca derruba o restante.

## Adapter real (Serpro, #66)

`OBRIGACOES_FISCAIS_MODO=serpro` troca o mock pelo `ObrigacoesFiscaisSerproGateway` (Integra Contador). Trial no Preview e
produção com e-CNPJ no Production, por `SERPRO_AMBIENTE`: variáveis e guarda do certificado em `docs/deploy/serpro.md`. Traduções: DAS = PGDASD/GERARDAS12 do **mês anterior**; parcelamento = o parcelamento **ordinário** do regime do Cliente (PARCSN para Simples Nacional, PARCMEI para MEI; PERT e RELP estão fechados a novas adesões), na parcela do
**mês corrente**, só PDF (sem valor/vencimento); autorização = Integra-Procurações (vigente se alguma procuração não venceu).
A **CND** é porta separada (`CertidaoCndPort`, `CND_MODO`, 3 variáveis `SERPRO_CND_*`): produto avulso "Consulta CND", token próprio sem certificado, consulta repetida com a `Chave` enquanto o status for 7. O endpoint de produção (`consulta-cnd/v1/certidao`) foi inferido do exemplo de trial: confirmar no Swagger com o contrato ativo.

## Mock

`POST /__modo` com `{"modo": "normal" | "falha" | "sem_autorizacao"}` troca o cenário:
`falha` responde 503 em tudo; `sem_autorizacao` devolve `vigente: false`.

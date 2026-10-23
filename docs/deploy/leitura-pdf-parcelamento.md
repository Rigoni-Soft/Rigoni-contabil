# Leitura do PDF de parcelamento (#125): variáveis e deploy

Ao anexar o PDF do acordo no Editar cliente, o sistema lê o código e a quantidade de parcelas e os sugere na linha. A leitura
nunca bloqueia o salvar e a falha não gera alerta. A porta é neutra (`LeitorDeParcelamentoPort`, ADR 0004); só o adapter fala
com a Anthropic. Pesquisa de base: `docs/pesquisa/anthropic-leitura-pdf.md`.

| Variável | O que é | Segredo |
|---|---|---|
| `LEITURA_PDF_MODO` | `falso` (padrão: leitor determinístico, sem rede, usado em dev, CI e Preview) ou `real` (API da Anthropic) | não |
| `ANTHROPIC_API_KEY` | chave da API (Console da Anthropic > API keys); o `env.ts` a exige com `LEITURA_PDF_MODO=real` | **sim** |
| `LEITURA_PDF_MODELO` | ID do modelo; padrão `claude-haiku-5-5`. Os IDs são snapshots fixos: trocar de modelo é trocar a string | não |

## Na Vercel

```
vercel env add LEITURA_PDF_MODO production           # real
vercel env add LEITURA_PDF_MODELO production         # claude-haiku-5-5 (ou claude-sonnet-5-5)
vercel env add ANTHROPIC_API_KEY production --sensitive
```

Preview e CI ficam em `falso`: nenhum teste chama a API.

## Comportamento

- O PDF vai **inline em base64** na Messages API (bloco `document` + saída estruturada JSON), sem Files API: é dado fiscal do
  Cliente e a Files API não é elegível a retenção zero. O `request-id` vai só para o log; o PDF nunca.
- Sem retentativa: qualquer falha vira "não consegui ler: digite à mão". Mapeamento: 429/413 → `limite`; refusal →
  `recusado`; JSON inválido ou `max_tokens` → `ilegivel`; 5xx, 401/402/403, rede e timeout → `indisponivel`.
- **PDF sem código** (o Recibo de Adesão não imprime um): o leitor devolve `codigo: null` e o sistema gera um código interno
  `PARC-XXXXXXXX`, sinalizado na tela ("o PDF não traz código: gerei um, você pode trocar"). O Serpro emite a guia só pela
  parcela (`parcelaParaEmitir`), então o código é rótulo; a equivalência com o `numeroParcelamento` do Serpro segue a confirmar
  em CNPJ real (spec #121).
- Limite do anexo na tela: 4 MB (teto do corpo de uma Server Action na Vercel, ADR 0007).

## O que se lê e se guarda

Dois modelos de PDF foram analisados (um da Receita Federal, do Simples Nacional; outro da PGFN, SISPAR/Regularize):

| Dado | Receita (Simples) | PGFN | Destino |
|---|---|---|---|
| Código | não tem (o "Recibo: …" não é o número do parcelamento) | "Número da conta de negociação" | `codigo` (gerado `PARC-XXXXXXXX` se faltar) |
| Parcelas | "Número de parcelas" | soma de Entrada + prestações (ex.: 1 + 4 = 5) | `parcelas_restantes` (sugerido) e `total_parcelas` |
| Valor da parcela | "Valor das demais parcelas" | prestação "Básica" | `valor_parcela_centavos` |
| Data | confirmação recebida em | informações prestadas em | `data_adesao` |
| Órgão | Receita Federal | PGFN | `origem` (`receita_federal` ou `pgfn`) |
| CNPJ | sim | sim | **não se grava**: só confere com o do Cliente (aviso na tela, sem bloquear) |

Os quatro dados do acordo (`origem`, `total_parcelas`, `valor_parcela_centavos`, `data_adesao`) são informativos, nulos quando o PDF
não os traz ou o Parcelamento foi digitado à mão, e só a criação os grava. Servem para conferir o valor da guia emitida, saber de
onde veio o acordo e a data de adesão (a primeira parcela não paga derruba o acordo). A emissão da guia de `origem = pgfn` não
usa o PARCSN do Serpro: ver a dívida técnica #172.

## Antes de ligar em Production

- Validar a precisão da leitura com PDFs reais (recibo de adesão, extrato): a pesquisa não afirma precisão nenhuma.
- Confirmar numa chamada real que `document` combina com `output_config.format` (as páginas da Anthropic não declaram nem proíbem).
- Decidir se pede retenção zero (ZDR) à Anthropic; sem ela, o padrão é a Anthropic não reter prompts e saídas.

## Falso nos testes

O leitor falso lê marcadores no texto do PDF: sem marcador sugere `FALSO-123456` com 12 parcelas; `[leitor:falha]` não lê;
`[leitor:sem-codigo]` lê só as 7 parcelas.

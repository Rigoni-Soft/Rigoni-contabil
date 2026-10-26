# Leitura do PDF de parcelamento (#125): variável e deploy

Ao anexar o PDF do acordo no Editar cliente, o sistema lê o código e a quantidade de parcelas e os sugere na linha. A leitura
nunca bloqueia o salvar e a falha não gera alerta. A porta é neutra (`LeitorDeParcelamentoPort`, ADR 0004).

A leitura é **direta na camada de texto do PDF** (biblioteca `unpdf`, JS puro, sem API externa): os recibos da Receita e da PGFN
são PDFs digitais, então um parser por modelo basta. O dado fiscal do Cliente não sai do servidor, sem custo por leitura e sem chave.

| Variável | O que é | Segredo |
|---|---|---|
| `LEITURA_PDF_MODO` | `falso` (padrão: leitor determinístico, sem rede, usado em dev, CI e Preview) ou `texto` (lê o PDF de verdade) | não |

## Na Vercel

```
vercel env add LEITURA_PDF_MODO production           # texto
```

Preview e CI ficam em `falso`: os testes não dependem do conteúdo dos PDFs.

## Comportamento

- Um parser por modelo conhecido, escolhido pelo marcador do órgão no texto. Modelo desconhecido, PDF escaneado (sem camada de
  texto), PDF corrompido ou campo essencial ausente (nº de parcelas) viram "não consegui ler: digite à mão".
- **PDF sem código** (o Recibo de Adesão da Receita não imprime um): o leitor devolve `codigo: null` e o sistema gera um código
  interno `PARC-XXXXXXXX`, sinalizado na tela ("o PDF não traz código: gerei um, você pode trocar"). O Serpro emite a guia só pela
  parcela (`parcelaParaEmitir`), então o código é rótulo; a equivalência com o `numeroParcelamento` do Serpro segue a confirmar em
  CNPJ real (spec #121).
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

## Quando ajustar

- **Modelo novo de PDF** (outro órgão, outra modalidade ou layout alterado): é preciso um parser novo (ou ajuste do atual) em
  `leitor-de-parcelamento-texto.gateway.ts`, com um exemplo do PDF. Até lá, cai no "digite à mão".
- **PDF escaneado (foto)**: não tem texto para ler. OCR só se aparecer na prática.
- Os testes usam textos sintéticos no formato da extração; PDFs reais (têm CNPJ e dados pessoais) não vão para o repositório.

## Falso nos testes

O leitor falso (modo `falso`) lê marcadores no texto do PDF: sem marcador sugere `FALSO-123456` com 12 parcelas; `[leitor:falha]` não lê;
`[leitor:sem-codigo]` lê só as 7 parcelas; `[leitor:cnpj-outro]` lê o CNPJ de outra empresa.

## Guia mensal da parcela PGFN (anexo e confirmação à mão, #183)

Na linha de um Parcelamento de `origem = pgfn` já salvo, o Funcionário SN Responsável, o Líder SN ou o Admin anexa a guia do mês (PDF
até 4 MB), informa a competência e a conta de negociação e a confirma. O PDF **não é lido** nesta etapa: a guia nasce "a confirmar" e só a
confirmação à mão a libera para envio. Nada a configurar: usa o bucket privado `parcelamentos-clientes`, no prefixo
`{cliente}/guias-pgfn/{parcelamento}/{AAAAMM}-{uuid}.pdf`, sem policy de usuário (só o servidor lê e grava). O servidor relê tipo e
tamanho no Storage depois do upload e apaga o objeto recusado. Tabela `cliente_parcelamento_guias` (uma linha por Parcelamento e
competência; quem anexou/confirmou e quando; auditoria `parcelamento.anexar-guia` e `parcelamento.confirmar-guia`).

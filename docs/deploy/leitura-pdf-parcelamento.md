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

## Guia mensal da parcela PGFN (anexo, leitura e confirmação, #183 e #185)

Na linha de um Parcelamento de `origem = pgfn` já salvo, o Funcionário SN Responsável, o Líder SN ou o Admin anexa a guia do mês (PDF
até 4 MB). Nada a configurar além de `LEITURA_PDF_MODO` (a mesma variável do acordo): usa o bucket privado `parcelamentos-clientes`, no
prefixo `{cliente}/guias-pgfn/{parcelamento}/{AAAAMM}-{uuid}.pdf`, sem policy de usuário (só o servidor lê e grava). Tabela
`cliente_parcelamento_guias` (uma linha por Parcelamento e competência; quem anexou/confirmou e quando; auditoria
`parcelamento.anexar-guia` e `parcelamento.confirmar-guia`).

**Leitura (porta `LeitorDeGuiaDeParcelaPort`, irmã da do acordo, nunca rejeita).** Um modelo só: o "Documento de Arrecadação do
Simples Nacional" (DAS do SENDA), igual na entrada e na parcela mensal. Lê CNPJ, conta de negociação (Observações, `PGFN-SISPAR:`),
competência (Período de Apuração, AAAAMM), vencimento e valor. O servidor lê o PDF **antes** de subir o arquivo e confere com o Cliente
e o Parcelamento:

| Situação | Resultado |
|---|---|
| CNPJ, conta (= `codigo` do Parcelamento) e competência conferem | a guia nasce **confirmada** na hora |
| CNPJ de **outra empresa** | anexo **recusado**; nada vai ao Storage (sem objeto órfão) |
| conta diferente, PDF sem CNPJ/conta/competência, texto digitado diferente do PDF | **a confirmar**, com o motivo na resposta do anexo |
| PDF ilegível, escaneado, corrompido ou modelo desconhecido | **a confirmar**; competência e conta (opcional: vale a do Parcelamento) são digitadas à mão. Sem competência lida nem digitada, o anexo pede a competência |

Vencimento e valor são informativos e não bloqueiam. O motivo aparece na tela ao anexar, mas **não é gravado**: depois de recarregar a
guia aparece só como "A confirmar". A confirmação à mão continua valendo para qualquer guia "a confirmar".

**Falso (dev, CI, Preview)**: sem marcador lê sem nada conferível (a guia fica a confirmar); `[leitor:falha]` não lê;
`[leitor:cnpj-outro]` lê o CNPJ de outra empresa; `[leitor:guia=<cnpj>;<conta>;<AAAAMM>]` lê esses três (para a guia nascer confirmada).

**Calibrar com um PDF real**: as expressões do DAS (`leitor-de-guia-de-parcela-texto.gateway.ts`) seguem o formato descrito no #175, mas os
testes usam texto sintético. Com um PDF real em mãos (fora do repositório), conferir se o texto extraído bate com os rótulos
("Período de Apuração", "Data de Vencimento", "Valor Total do Documento", `PGFN-SISPAR:`); se não, o efeito é a guia ficar "a confirmar".

# Leitura da foto do Cartão de ponto: variáveis, custo e medição

Na Folha de ponto do Cliente, "Ler foto do cartão" (só o Responsável do RH) recebe a foto de uma quinzena
(JPEG ou PNG, até 4 MB, o teto do corpo de uma Server Action na Vercel, ADR 0007). A leitura é uma cascata atrás da
porta neutra `LeitorDeCartaoPort` (ADR 0004 e 0011): **OCR local primeiro**, **visão da API só se o OCR não leu**,
**digitação manual** se nenhum leu. A foto não é guardada.

| Variável | O que é | Segredo |
|---|---|---|
| `LEITURA_CARTAO_MODO` | `falso` (padrão: devolve sempre o cartão do "Erick Falso", sem rede; dev, CI e Preview), `indisponivel` (toda leitura cai na digitação), `ocr` (só o OCR local, nunca chama a API) ou `ocr_visao` (OCR e, se falhar, a API) | não |
| `ANTHROPIC_API_KEY` | Chave da API; obrigatória com `ocr_visao` (o app não sobe sem ela) | sim |
| `LEITURA_CARTAO_MODELO` | Modelo de visão do fallback; padrão `claude-haiku-5-5` (o mais barato) | não |

## Produção

O `falso` gravaria um empregado inventado num Cliente de verdade: a Produção fica em `indisponivel` até haver
medição aceita pelo escritório, depois em `ocr` ou `ocr_visao`.

```
vercel env add LEITURA_CARTAO_MODO production     # indisponivel
```

Para ligar o fallback: contrato do provedor com **retenção zero e sem treino** nos dados enviados (ADR 0011), a
chave em `ANTHROPIC_API_KEY` (use `printf` no `vercel env add`, nunca pipe do PowerShell: grava BOM) e
`LEITURA_CARTAO_MODO=ocr_visao`.

## Como lê

- **OCR** (`tesseract.js`, modelo `por` de `assets/tessdata`, 2 MB, no deploy via `outputFileTracingIncludes`): cada
  foto sobe e derruba o próprio worker (~0,6 a 1,2 s por foto na máquina de desenvolvimento). Só vale se o nome e
  cada linha de dia tiverem confiança de 80 ou mais e número par de horários.
- **Visão** (`/v1/messages`, imagem em base64, ferramenta `registrar_cartao` com esquema JSON, `tool_choice`
  forçado): devolve nome, dias, batidas, coluna Extra e a anotação "faltou" ou "atestado". Tempo máximo de 45 s.
- O **domínio valida** as duas (`validarLeitura`); leitura reprovada passa ao leitor seguinte.
- Efeitos: empregado achado pelo nome (primeiro nome casa com o nome inteiro do quadro; mais de um = digitar) ou
  cadastrado com a Jornada deduzida das batidas; o cartão da quinzena é iniciado (dia útil vazio vira falta,
  fim de semana vazio é ignorado, salvo Extra); dia com "atestado" ganha Abono; dia em branco não apaga o que
  já foi digitado.

## Custo e volume

Só o fallback tem custo. Uma foto de ~190 KB gasta na ordem de 1.500 a 2.500 tokens de entrada e algumas centenas
de saída; no modelo padrão isso é uma fração de centavo de dólar por cartão (confira o preço vigente do modelo
antes de projetar). Volume esperado: empregados × 2 quinzenas × Clientes que usam a tela; **no pior caso, todo
cartão cai na API** (ver medição abaixo). O gasto se acompanha no painel do provedor; não há limite no sistema.

## Medição nos cartões de exemplo (12/11/2026)

Os cartões ficam fora do repositório (`Downloads`: 18 fotos `ponto-*-quin-*.jpeg` encontradas, das 19 citadas na
issue, mais 3 `atestado-medico-*`). OCR local, modo 6, nas 18 fotos de ponto:

| Resultado do OCR | Fotos |
|---|---|
| Passou na validação do domínio | **0 de 18** |
| Leu mas o nome foi reprovado (letra à mão, confiança baixa) | 13 |
| Não leu (nome ou linha de dia abaixo da confiança, ou horário ímpar) | 5 |

O OCR clássico não lê a letra à mão nem o carimbo desbotado deste cartão: na prática **toda foto cai no
fallback**, e a economia de custo esperada só aparece com fotos mais limpas ou com OCR melhor (pré-processamento,
recorte do campo do nome). **O acerto do fallback (visão) não foi medido**: falta a `ANTHROPIC_API_KEY` neste
ambiente. Para medir, ligue `ocr_visao` num ambiente de teste, suba os 18 cartões e confira os horários lidos
contra a foto; reporte aqui.

# Leitura da foto do Cartão de ponto: variáveis, custo e medição

Na Folha de ponto do Cliente, "Ler foto do cartão" (só o Responsável do RH) recebe a foto de uma quinzena
(JPEG ou PNG, até 4 MB, o teto do corpo de uma Server Action na Vercel, ADR 0007). Um modelo de visão, atrás da
porta neutra `LeitorDeCartaoPort` (ADR 0004 e 0011), devolve o cartão em JSON; o domínio valida e, se a leitura
falhar ou reprovar, a tela manda digitar à mão. A foto não é guardada.

| Variável | O que é | Segredo |
|---|---|---|
| `LEITURA_CARTAO_MODO` | `falso` (padrão: devolve sempre o cartão do "Erick Falso", sem rede; dev, CI e Preview), `indisponivel` (toda leitura cai na digitação) ou `visao` (API de visão) | não |
| `ANTHROPIC_API_KEY` | Chave da API; obrigatória com `visao` (o app não sobe sem ela) | sim |
| `LEITURA_CARTAO_MODELO` | Modelo de visão; padrão `claude-haiku-5-5` (o mais barato) | não |

## Produção

O `falso` gravaria um empregado inventado num Cliente de verdade: a Produção fica em `indisponivel` até haver
medição aceita pelo escritório, depois em `visao`.

```
vercel env add LEITURA_CARTAO_MODO production     # indisponivel
```

Para ligar: contrato do provedor com **retenção zero e sem treino** nos dados enviados (ADR 0011), a chave em
`ANTHROPIC_API_KEY` (use `printf` no `vercel env add`, nunca pipe do PowerShell: grava BOM) e
`LEITURA_CARTAO_MODO=visao`.

## Como lê

- Chamada a `/v1/messages` com a imagem em base64 e a ferramenta `registrar_cartao` (esquema JSON, `tool_choice`
  forçado): nome, dias, batidas, coluna Extra e a anotação "faltou" ou "atestado". Tempo máximo de 45 s; erro de
  rede, status ou formato fora do esquema vira "não leu".
- O **domínio valida** (`validarLeitura`): reprovou = digitação manual.
- Efeitos: empregado achado pelo nome (primeiro nome casa com o nome inteiro do quadro; mais de um = digitar) ou
  cadastrado com a Jornada deduzida das batidas; o cartão da quinzena é iniciado (dia útil vazio vira falta, fim
  de semana vazio é ignorado, salvo Extra); dia com "atestado" ganha Abono; dia em branco não apaga o que já foi
  digitado.

## Custo e volume

Toda foto lida custa. Uma foto de ~190 KB gasta na ordem de 1.500 a 2.500 tokens de entrada e algumas centenas de
saída; no modelo padrão isso é uma fração de centavo de dólar por cartão (confira o preço vigente antes de
projetar). Volume esperado: empregados × 2 quinzenas × Clientes que usam a tela. O gasto se acompanha no painel
do provedor; não há limite no sistema.

## Medição nos cartões de exemplo

Os cartões ficam fora do repositório (`Downloads`: 18 fotos `ponto-*-quin-*.jpeg` encontradas, das 19 citadas na
issue, mais 3 `atestado-medico-*`). **O acerto da visão ainda não foi medido**: falta a `ANTHROPIC_API_KEY` no
ambiente de desenvolvimento. Para medir, ligue `visao` num ambiente de teste, suba os cartões e confira os
horários lidos contra a foto; reporte aqui.

Registro (12/11/2026): um OCR local (tesseract.js, modelo `por`) foi testado antes como primeiro leitor e
descartado: 0 das 18 fotos passou na validação (13 com nome ilegível, 5 sem leitura), por causa da letra à mão e
do carimbo desbotado.

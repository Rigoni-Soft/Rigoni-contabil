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

Os cartões ficam fora do repositório (`Downloads`: 17 fotos `ponto-*-quin-*.jpeg` das 19 citadas na issue, mais 3
`atestado-medico-*`). Para medir: `yarn medir:leitura <pasta> [AAAA-MM]` (chama a API de verdade e lê a chave do
`.env.local`); ele roda o leitor e o validador reais e imprime um CSV com o que cada foto leu.

Medição de 12/11/2026 com `claude-haiku-5-5`, competência 2026-08 (as fotos são de agosto; com setembro, que tem
30 dias, 10 de 17 reprovavam por "dia 31"): **14 de 17 validaram**. As 3 restantes: Matheus (as duas fotos têm os
arquivos trocados, a "quin-1" traz os dias 16 a 31 e a "quin-2" os dias 1 a 15, então o validador recusou com razão)
e Roberto quin-1 (erro de API nessa rodada; na rodada com setembro tinha sido lido). O acerto dos horários contra a
foto não foi conferido: o script mede validação, não verdade.

Segunda medição (12/11/2026), `claude-sonnet-5-5` com esforço `medium` (`LEITURA_CARTAO_MODELO=claude-sonnet-5-5 ESFORCO=medium yarn medir:leitura <pasta> 2026-08`):
**14 de 17 validaram**, as mesmas 2 do Matheus (arquivos trocados) mais Luan quin-2 ("horários fora de ordem no dia 26"). Conferência
manual contra a foto de 2 cartões (Erick e Laura, 1ª quinzena, 26 dias de batidas): todos os horários lidos batem com a
imagem, inclusive os carimbos desbotados; as únicas dúvidas foram o dia 3 do Erick (08:36 lido, manuscrito ambíguo) e o
dia 7 do Erick, em que a tarde está cortada na foto e o modelo omitiu o par, como pedido.
**Atenção:** o Sonnet 5.5 recusa `tool_choice` forçado (HTTP 400 "type tool and any are not supported for this model"); o
gateway de produção só funciona com ele se passar a `auto`. O script já faz isso; o gateway ainda não.

Registro (12/11/2026): um OCR local (tesseract.js, modelo `por`) foi testado antes como primeiro leitor e
descartado: 0 das 18 fotos passou na validação (13 com nome ilegível, 5 sem leitura), por causa da letra à mão e
do carimbo desbotado.

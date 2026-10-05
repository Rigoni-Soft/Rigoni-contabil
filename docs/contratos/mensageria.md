# Contrato: mensageria com o Contato

Contrato **neutro** de receber e enviar mensagens. Nenhum termo de canal/provedor (WhatsApp, Telegram) aparece
aqui; traduzir pro formato do provedor é trabalho do adapter real (#68). Ver ADR 0004.

Configuração: `MENSAGERIA_MODO` = `falso` (padrão) | `real` (ainda não existe, #68).

## Entrada (webhook)

`POST /api/webhooks/mensagens` com JSON `{ "telefone": "5511912345678", "texto": "oi" }`.
`telefone` é só dígitos, com ou sem DDI 55 (o sistema descarta o DDI ao procurar o Contato).

| Status | Quando |
|---|---|
| 200 | processou (inclusive número desconhecido, que recebe aviso) |
| 400 | corpo que não é JSON ou fora do contrato |
| 502 | falha transitória (identificação ou envio): o remetente deve tentar de novo |

Fora do escopo do #40, vão com o adapter real (#68): verificação de assinatura e idempotência por id de evento
(docs/arquitetura.md, seção 3.13).

## Saída

Porta `EnvioMensagemPort.enviar({ telefone, texto })`. O adapter falso só registra (memória + `console.info`).

## Fluxo

Número de um Contato (padrão ou outro) de um Cliente recebe saudação nominal + menu (1 contrato social e
alterações, 2 guia de imposto, 3 guia de parcelamento, 4 CND, 5 falar com atendente). Responder de `1` a `5`
devolve "em construção" (stub). Qualquer outro texto reenvia o menu.

# Contrato: mensageria com o Contato (WhatsApp Cloud API)

A **porta** do sistema é neutra (`ReceberMensagemPort`, `EnvioMensagemPort`: `{ telefone, texto }` e `{ telefone, url, nomeArquivo }` para documentos), mas a borda
HTTP e o adapter falso reproduzem a **WhatsApp Cloud API da Meta**, pra que o adapter real (#68) só troque a
implementação. Fonte: documentação oficial da Meta (webhooks, Messages API, códigos de erro). Ver ADR 0004.

Configuração: `MENSAGERIA_MODO` = `falso` (padrão) | `real` (ainda não existe, #68);
`MENSAGERIA_SEGREDO_ASSINATURA` (app secret) e `MENSAGERIA_TOKEN_VERIFICACAO` (padrões falsos em dev).

## Entrada: `/api/webhooks/whatsapp`

### `GET` — handshake de verificação

Query `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.

| Status | Quando |
|---|---|
| 200 | corpo = valor de `hub.challenge` (token confere) |
| 403 | token errado ou `hub.mode` diferente de `subscribe` |
| 400 | algum `hub.*` ausente |

### `POST` — notificação

Cabeçalho `X-Hub-Signature-256: sha256=<HMAC-SHA256 hex do corpo cru com o app secret>`. Corpo:

```json
{ "object": "whatsapp_business_account",
  "entry": [{ "id": "…", "changes": [{ "field": "messages", "value": {
    "messaging_product": "whatsapp",
    "metadata": { "display_phone_number": "…", "phone_number_id": "…" },
    "contacts": [{ "profile": { "name": "…" }, "wa_id": "5511912345678" }],
    "messages": [{ "from": "5511912345678", "id": "wamid.…", "timestamp": "…", "type": "text",
                   "text": { "body": "oi" } }] } }] }] }
```

Lotes (várias entries/changes/messages) são processados em ordem. `statuses` (sent/delivered/read/failed) são
aceitos e ignorados. Mensagem sem `text` (áudio, imagem…) reabre o menu.

A Meta só entende **200**: qualquer outro status faz ela reenviar, com frequência decrescente, por dias. Por isso:

| Status | Quando |
|---|---|
| 200 | processou; ignorou status/tipo sem efeito; **ou** falha permanente de envio (erro 4xx da Cloud API, ex. 133010 número sem WhatsApp, 131047 janela de 24h): registrada em log, sem reenvio |
| 400 | corpo não é JSON ou não é o formato da Cloud API |
| 403 | assinatura ausente ou inválida (nada é processado) |
| 502 | falha transitória (banco, 401/403/429/5xx da Cloud API): a Meta reenvia |

## Saída

Adapter falso (`EnvioMensagemFalsoGateway`) monta o corpo de `POST /{phone-number-id}/messages`:
`{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } }` e responde como a
Cloud API: **200** `{ messaging_product, contacts: [{ input, wa_id }], messages: [{ id: "wamid.…", message_status: "accepted" }] }`
ou erro `{ error: { message, type, code, fbtrace_id } }` com o status HTTP da tabela da Meta (0/190 → 401; 3/10/131005 → 403;
4/80007/130429/131048/131049/131056 → 429; 131000 → 500; 131008/131009/131021/131026/131047/133010 → 400). Erros 400
viram `ValidationError` (permanentes); os demais, `ServicoExternoError`. O adapter nunca envia de verdade; o construtor
aceita `{ telefone: código }` pra simular uma falha.

Documento (#41): corpo `{ messaging_product, recipient_type, to, type: "document", document: { link, filename } }`, mesma
resposta/erros do texto. O `link` é uma URL assinada do Storage (bucket privado `documentos-clientes`) válida por 5 min.

## Fluxo

Número de um Contato (padrão ou outro) de um Cliente recebe saudação nominal + menu (1 contrato social e
alterações, 2 guia de imposto, 3 guia de parcelamento, 4 CND, 5 falar com atendente). `2` a `5` devolve "em
construção" (stub); qualquer outro texto reenvia o menu.

**Opção 1 (#41):** pergunta `1 - Contrato social`, `2 - Alterações`, `3 - Ambos`.
- `1` envia o contrato; sem contrato cadastrado, avisa.
- `2` envia a alteração; `3` envia o contrato **e** a alteração escolhida. Com uma só alteração, envia direto; sem
  nenhuma, avisa (`3` ainda entrega o contrato).
- Com várias alterações, lista da **mais recente à mais antiga**, 10 por página (`1 - Alteração de 15/03/2020`…);
  `mais` avança a página e o cliente responde com o número da página corrente. Número fora da lista ou `mais` na última
  página reapresenta a página.
- `menu` abandona o fluxo a qualquer momento. Número não identificado nunca chega aos documentos.

**Sessão (`atendimento_sessoes`):** guarda só a posição no menu (`etapa`, `modo`, `pagina`), nunca dado do Cliente:
nome, empresa, CNPJ e caminhos são relidos a cada mensagem. A chave é um HMAC-SHA256 do telefone (segredo
`MENSAGERIA_SEGREDO_ASSINATURA`), nunca o número; expira em 10 min (ignorada na leitura, varrida a cada gravação);
RLS ligada sem policy (só `service_role`). A sessão só é encerrada depois do envio: se falhar, a Meta reenvia e o
cliente retoma do mesmo ponto. Limite: se uma alteração for cadastrada com a sessão aberta, o número escolhido pode
apontar para outra.

## Ainda não coberto (vai com a #68)

Idempotência por `wamid` (a Meta não garante deduplicar reenvios; um lote reenviado reprocessa mensagens já
respondidas), janela de 24h e templates, e o adapter HTTP real.

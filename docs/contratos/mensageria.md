# Contrato: mensageria com o Contato (WhatsApp Cloud API)

A **porta** do sistema é neutra (`ReceberMensagemPort`, `EnvioMensagemPort`: `{ telefone, texto }` e `{ telefone, url, nomeArquivo }` para documentos), mas a borda
HTTP e o adapter falso reproduzem a **WhatsApp Cloud API da Meta**, pra que o adapter real (#68) só troque a
implementação. Fonte: documentação oficial da Meta (webhooks, Messages API, códigos de erro). Ver ADR 0004.

Configuração: `MENSAGERIA_MODO` = `falso` (padrão) | `real` (ainda não existe, #68);
`MENSAGERIA_SEGREDO_ASSINATURA` (app secret) e `MENSAGERIA_TOKEN_VERIFICACAO` e `MENSAGERIA_SEGREDO_SESSAO` (chave do HMAC da sessão da URA, separada da assinatura; padrões falsos em dev).

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
aceitos e ignorados. Mensagem de tipo sem tratamento (vídeo, figurinha, localização…) chega sem `text` e reabre o menu; `audio`, `image` e `document` seguem o fluxo de mídia abaixo (#81).

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

Template (#51): corpo `{ ..., type: "template", template: { name, language: { code }, components } }`; `components` leva um
`header` com `document` (templates de guia) e um `body` com as variáveis na ordem `{{1}}`, `{{2}}`…

Documento (#41): corpo `{ messaging_product, recipient_type, to, type: "document", document: { link, filename } }`, mesma
resposta/erros do texto. O `link` é uma URL assinada do Storage (bucket privado `documentos-clientes`) válida por 5 min.

Painel do Funcionário (#49): o Funcionário responde por texto (`enviar`, até 4096 caracteres) e dispara contrato social/alterações (`enviarDocumento`, o mesmo do menu da URA) pelas mesmas chamadas acima. Só vira Mensagem do Atendimento o que o provedor aceitou: se o envio falha, nada é registrado.

Reação (#84): o Funcionário reage com emoji a uma Mensagem do cliente (`reagir`, porta neutra). O corpo é `{ messaging_product, recipient_type, to, type: "reaction", reaction: { message_id, emoji } }`, com `message_id` o `wamid` da Mensagem do cliente, **guardado em `mensagens.id_externo`** na entrada (abertura do Atendimento e anexo). `emoji` vazio remove a reação. Uma reação por Mensagem (`mensagens.reacao`); só é gravada depois de o provedor aceitar. Mensagem sem `id_externo` (anterior ao #84) não aceita reação. O `id_externo` também deduplica a reentrega do webhook: índice único parcial `(atendimento_id, id_externo)`, e o anexo repetido não insere de novo (continua `anexada`, a Meta recebe 200). O emoji precisa conter pictograma ou bandeira (até 16 unidades UTF-16).

Anexo do Funcionário (#79): `enviarAnexo({ telefone, tipo: "imagem" | "audio" | "documento", url, nomeArquivo, legenda? })`. O corpo segue a Cloud API: `image: { link, caption? }`, `document: { link, filename, caption? }` e `audio: { link }` (áudio não tem legenda). O `link` é uma URL assinada do bucket privado `anexos-atendimento` (separado de `documentos-clientes`), válida por 1 h. Aceitos: JPEG, PNG, WebP, PDF, Word, Excel, PowerPoint, TXT, CSV e ZIP, até 10 MB; a lista é por tipo MIME (nunca pela extensão; SVG e HTML recusados), conferida no servidor e repetida no bucket (`allowed_mime_types`, `file_size_limit`). A Mensagem guarda `anexo_tipo`, `anexo_nome`, `anexo_caminho` e `anexo_tamanho` (os quatro juntos ou nenhum) e `texto` é a legenda; o arquivo só vira Mensagem depois de o provedor aceitar, e se o envio falha o arquivo guardado é removido. Para imagem, o formulário gera uma miniatura WebP (lado maior 320 px, até 256 KB) que vai junto, é guardada no mesmo bucket (`anexo_miniatura_caminho`) e é a que a conversa mostra; o original só é baixado ao ampliar e é o único que segue ao cliente. A miniatura é opcional: inválida ou com falha ao guardar, o envio continua. Auditoria: `atendimento.enviar_anexo`.

## Mídia recebida do cliente (#81)

`audio` (inclusive mensagem de voz), `image` e `document` chegam com um objeto `{ id, mime_type, caption?, filename? }`. O
webhook os entrega a um caso de uso próprio, atrás da porta neutra `DownloadMidiaPort` (`baixar(idDaMidia) → { bytes, mime, nome? }`;
o adapter falso devolve arquivos de teste pelo id: `midia-teste-audio` (ogg/opus tocável), `-imagem`, `-documento`, `-grande`
(acima de 10 MB), `-svg` e `-fora-do-ar`; o real, que troca o id pelo endereço temporário e baixa com o token, é da #68).

- **Só dentro de um Atendimento em andamento.** De um número sem Atendimento (inclusive quem está no menu da URA) a mídia não é
  baixada nem guardada, não abre Atendimento nem reabre o menu: a URA responde que, por ora, só entende texto. A checagem
  acontece antes do download.
- **Guardada** no bucket `anexos-atendimento` e nas mesmas colunas de anexo da Mensagem (#79), como Mensagem do contato; a
  legenda de imagem/documento é o `texto`. Mesmos limites e tipos do envio do Funcionário (10 MB, lista de MIMEs, SVG/HTML recusados);
  áudio só ogg (Opus) ou mp4/AAC. Imagem recebida não ganha miniatura: a conversa mostra o original.
- **Recusada** (acima do limite, tipo não aceito ou mídia que o provedor não entrega mais): vira uma Mensagem da URA na
  conversa ("o cliente enviou um arquivo que não pôde ser recebido") e o webhook responde 200.
- **Idempotência** pelo `wamid` (`mensagens.id_externo`, índice único por Atendimento): a reentrega nem baixa o arquivo de novo; se
  duas chegarem ao mesmo tempo, o banco grava uma só e o arquivo que sobrou é removido.
- **Falha transitória** ao baixar ou guardar (`ServicoExternoError`) responde 502, e a Meta reenvia o evento; é essa
  reentrega que reprocessa, não há fila própria.
- **Visualizar e baixar** (todo anexo da conversa, do cliente ou do Funcionário): cada anexo tem dois links temporários do mesmo
  objeto, o de **download** (cabeçalho de anexo, com o nome original, vai para a pasta Downloads) e o de **visualização** (sem esse
  cabeçalho). Imagem amplia no painel e baixa pelo botão "Baixar". Arquivo (PDF, TXT, Word, Excel, PowerPoint, CSV, ZIP...) tem
  sempre "Baixar"; "Visualizar" existe para PDF e TXT (aba nova do navegador) e para **.docx e .xlsx**, que o navegador lê
  sozinho (`mammoth` e `read-excel-file`, sem enviar o arquivo a serviço externo) e mostra num painel: o Word num iframe sem script
  (o arquivo é do cliente) e o Excel como tabela da primeira planilha, até 500 linhas. `.doc`, `.xls`, PowerPoint, CSV e ZIP só
  baixam. **Áudio** (e vídeo, que o sistema não recebe) não baixa: toca no player do chat (#80); o ogg/opus da mensagem de voz
  não toca no Safari e não há conversão para m4a nesta entrega.

Áudio enviado pelo Funcionário (#80): ver Anexo do Funcionário acima; aceito pela Meta é AAC, AMR, MP3, M4A (`audio/mp4`) e OGG **só com Opus**, até 16 MB (webm não é aceito).

## Fluxo

Número de um Contato (padrão ou outro) de um Cliente recebe saudação nominal + menu (1 contrato social e
alterações, 2 guia de imposto, 3 guia de parcelamento, 4 CND, 5 falar com atendente). `2` a `5` devolve "em
construção" (stub); qualquer outro texto reenvia o menu.

**Número não cadastrado (#43):** o atendimento pela URA só existe para Contato (padrão ou outro) já cadastrado. Quem não é
Contato recebe "você já é cliente?" (`sim`/`não`, com ou sem acento; outra resposta repete a instrução `Responda *sim* ou *não*.`). `não` → aviso
amigável de que será encaminhado à recepção. `sim` → pede o CNPJ (validado pelos dígitos verificadores; inválido pede de
novo). CNPJ válido que pertence a um Cliente → recepção (o número continua sem ser Contato). CNPJ válido que **não** existe
em nenhum cadastro → 1 nova tentativa (sessão `cnpj_nova_tentativa`; CNPJ inválido não gasta a tentativa); errando de novo,
vai à recepção com aviso de que o CNPJ não foi encontrado. **Fallback (#50):** em qualquer etapa da identificação, texto com palavra-chave de
atendente (`atendente`, `humano`, `recepção`, `recepcionista`, `suporte`, `ajuda`, `funcionário`, `dúvida`, "falar/conversar com alguém/uma pessoa/gente/o contador/a contadora"; palavras soltas como "pessoa" ou "atendimento" não contam) vai direto à recepção. Não há
auto-cadastro. Sessão (`ja_cliente`/`cnpj`/`cnpj_nova_tentativa`) ausente, expirada ou `menu` recomeça pela pergunta (e `menu` zera os contadores de respostas inválidas: é a saída de emergência do cliente, aceito de propósito).
A 3ª resposta inválida seguida (contador `invalidos` na sessão, em `ja_cliente` ou CNPJ) também vai à recepção. "Encaminhar à recepção" abre um Atendimento no Setor recepção (entra na Fila se não houver Funcionário livre).

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
`MENSAGERIA_SEGREDO_SESSAO`), nunca o número; expira em 10 min (ignorada na leitura, varrida a cada gravação);
RLS ligada sem policy (só `service_role`). A sessão só é encerrada depois do envio: se o envio falhar, a Meta reenvia e o
cliente retoma do mesmo ponto; se só o encerramento falhar, o erro é ignorado (não duplica o documento) e a sessão expira sozinha. A sessão da escolha de alteração guarda também um hash da lista exibida: se ela mudar
(inclusão/exclusão) antes da resposta, nada é entregue e a lista nova é mostrada.

Número que consta como Contato de mais de um Cliente é ambíguo: a URA não oferece documento e encaminha à recepção.

Em produção (`NODE_ENV=production`) a rota recusa qualquer segredo ausente ou igual ao placeholder de desenvolvimento
(`src/main/segredos-mensageria.factory.ts`), antes de validar HMAC ou criar o client privilegiado.

## Ainda não coberto (vai com a #68)

**Gate obrigatório antes de ativar qualquer envio real** (`MENSAGERIA_MODO=real`): idempotência durável por `wamid` e
por documento entregue (a Meta não garante deduplicar reenvios; um lote reenviado reprocessa mensagens já respondidas,
e um lote parcialmente processado, com 502 numa mensagem posterior, repete as anteriores; em "Ambos", falha na
alteração repete o contrato). Exige teste de lote parcial + retry. Hoje o modo real lança erro, então não há reenvio
real.

Também com a #68: credenciais reais, observabilidade e o adapter HTTP real. A decisão janela/template (#51) já existe em `EnviarComunicacaoProativa`, mas ainda não tem chamador nem composição em `main`.

## Inatividade (#73)

O aviso de 10 minutos e a mensagem final de encerramento saem pelo mesmo `enviar`. O aviso é reservado no banco antes do envio e o encerramento só ocorre com o aviso entregue; a mensagem final fica no histórico (gravada na transação que fecha) e, se o envio falhar, o job a reenvia. O job só roda com `INATIVIDADE_AUTOMATICA=ligada` e, em produção, com `MENSAGERIA_MODO=real` (ver `docs/deploy/inatividade-cron.md`).

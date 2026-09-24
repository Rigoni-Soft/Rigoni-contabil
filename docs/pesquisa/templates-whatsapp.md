# Templates de mensagem WhatsApp Business

> Ticket de origem: [#23](https://github.com/Rigoni-Soft/Rigoni-contabil/issues/23) — mapa wayfinder.
> Provedor assumido: Meta Cloud API / categoria **Utility** (ver [pesquisa do BSP](./whatsapp-bsp.md)).

Estes são os 3 templates que precisam de aprovação prévia da Meta, porque disparam **fora da janela de 24h** (seção 9 da spec original: lembrete de documento, envio de DAS, envio de guia de parcelamento). Dentro de uma conversa ativa (seção 12), a URA responde livremente com o template próprio do sistema — isso não precisa de aprovação.

Cada template segue o formato de submissão da Meta: nome (snake_case, imutável após aprovação), categoria, idioma, cabeçalho opcional, corpo com variáveis `{{n}}`, rodapé opcional, botões opcionais.

---

## 1. `lembrete_documento_obrigatorio`

Disparado pelo job da seção 9 (dias 01/05/10/15) para clientes com documento obrigatório = negativo.

- **Categoria**: Utility
- **Idioma**: pt_BR
- **Cabeçalho**: nenhum
- **Corpo**:
  > Olá, {{1}}! Aqui é da Rigoni Contábil. Ainda não recebemos os documentos fiscais de {{2}} referentes a este mês. Poderia nos enviar assim que possível, para não atrasarmos a apuração do Simples Nacional?
  - `{{1}}` — nome do contato padrão (ex.: "Ângela")
  - `{{2}}` — nome da empresa (ex.: "3A Construções e Reformas LTDA")
- **Rodapé**: `Rigoni Contábil · Simples Nacional`
- **Botões** (quick reply, respondem dentro da janela de 24h aberta pela resposta do cliente):
  - `Já enviei` — sinaliza ao setor que o cliente diz ter enviado (não muda o campo sozinho; abre a conversa para um Funcionário confirmar)
  - `Falar com atendente` — aciona o mesmo fallback de transferência já definido na seção 6

---

## 2. `envio_guia_das`

Disparado pelo job da seção 9 (dias 01/05/10/15) quando DAS = pronto, respeitando a forma de envio do cliente.

- **Categoria**: Utility
- **Idioma**: pt_BR
- **Cabeçalho**: Documento (PDF, dinâmico — o próprio arquivo da guia)
- **Corpo**:
  > Olá, {{1}}! Segue em anexo a guia do DAS de {{2}}, referente à competência {{3}}. O vencimento é dia {{4}}.
  - `{{1}}` — nome do contato
  - `{{2}}` — nome da empresa
  - `{{3}}` — competência (ex.: "09/2026")
  - `{{4}}` — data de vencimento (ex.: "20/10/2026")
- **Rodapé**: `Rigoni Contábil · Simples Nacional`
- **Botões**: `Falar com atendente`

---

## 3. `envio_guia_parcelamento`

Disparado pelo job da seção 9 (dias 20/22/24/26/28) quando parcelamento = pendente e tem parcelamento = positivo.

- **Categoria**: Utility
- **Idioma**: pt_BR
- **Cabeçalho**: Documento (PDF, dinâmico)
- **Corpo**:
  > Olá, {{1}}! Segue em anexo a guia de parcelamento de {{2}}, referente à parcela de {{3}}.
  - `{{1}}` — nome do contato
  - `{{2}}` — nome da empresa
  - `{{3}}` — competência/parcela (ex.: "parcela 4/12 — 09/2026")
- **Rodapé**: `Rigoni Contábil · Simples Nacional`
- **Botões**: `Falar com atendente`

---

## Fora do escopo de aprovação (não precisam de template Meta)

- Resposta da URA dentro de uma conversa ativa (menu, coleta de CNPJ, entrega de contrato social/CND/guias já geradas) — template próprio do sistema, seção 12.
- Aviso interno ao setor Simples Nacional (DAS não pronto, falha de job, procuração vencida) — não é mensagem ao cliente, não passa pela API do WhatsApp.
- Mensagem de transferência ao cliente ("você está sendo transferido para..." — seção 7) — acontece dentro da janela de 24h da conversa em curso.

## Pendências para quando o provedor for contratado

- Submeter os 3 templates acima no Meta Business Manager (ou via 360dialog) para aprovação antes do go-live dos jobs da seção 9.
- Confirmar se a Meta aceita cabeçalho de documento dinâmico por variável de mídia (sim, suportado — a URL do PDF é passada no envio, não no cadastro do template).

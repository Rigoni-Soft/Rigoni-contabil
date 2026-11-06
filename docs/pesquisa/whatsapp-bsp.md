# Pesquisa: Provedor/BSP de WhatsApp Business API

> Issue de origem: [#16](https://github.com/Rigoni-Soft/Rigoni-contabil/issues/16) — mapa wayfinder.
> Data da pesquisa: 2026-09-24.

## Contexto e requisitos

O sistema precisa de um backbone de atendimento via WhatsApp com:

1. Respostas dentro da janela de 24h (conversa ativa) usando templates próprios, sem custo de template pago.
2. Disparo proativo fora da janela de 24h (lembretes de documento, envio de guias) — **exige template aprovado pela Meta**.
3. Recebimento de mensagens via webhook.
4. Transferência de conversa entre atendentes (URA ↔ humano) e entre setores.
5. Escala moderada: ~1.000 clientes, 10 setores, 3 cidades — poucas centenas/poucos milhares de conversas/mês, não é operação de disparo em massa.

Ponto importante descoberto na pesquisa: desde a reforma de cobrança da Meta (vigente a partir de jul/2025, ainda em vigor em 2026), o modelo deixou de ser "por conversa de 24h" e passou a ser **por mensagem de template enviada**, com 4 categorias: Marketing, Utility, Authentication (cobradas) e Service (grátis, iniciada pelo cliente, dentro da janela de 24h). Isso não muda a arquitetura pedida pelo ticket (item 1 continua grátis, item 2 continua pago), só o detalhe de billing.

## Comparativo de opções

| Provedor | Custo aproximado | Integração | Templates aprovados | Verificação | Adequação ao porte |
|---|---|---|---|---|---|
| **Meta Cloud API direta** (sem BSP, self-service via Meta Business Manager) | R$ 0 de mensalidade de plataforma; só a tarifa da Meta por mensagem (Utility ~R$0,03–0,09, Marketing ~R$0,30–0,55, Authentication ~R$0,03–0,05; Service grátis). ~1.000 conversas de serviço/mês grátis. | Webhooks e REST API oficiais, bem documentados (Meta for Developers). Exige construir toda a camada de inbox/multi-atendente/transferência de setor por conta própria. | Sim, nativo (Meta Business Manager) | Verificação de negócio direta com a Meta (CNPJ, comprovante, domínio) — pode levar ~14 dias | Melhor custo variável, mas exige capacidade de dev interna para webhook, fila e UI de atendimento — que é exatamente o que este projeto já está construindo (app Next.js próprio) |
| **360dialog** (BSP "fino", sem markup nas tarifas Meta) | Plano Regular €49/mês (~R$290) por número; Premium €99/mês (~R$580, inclui Inbox/ferramenta de atendimento multi-agente); Scale €500/mês (alto volume). Sem markup sobre as tarifas da Meta. | API compatível com Cloud API + parceiros de inbox prontos (ou integração direta via webhook no app próprio) | Sim | Verificação facilitada pelo parceiro, 24–48h | Boa opção intermediária: custo fixo baixo, sem markup por mensagem, aprovação mais rápida que direto com a Meta |
| **Twilio** | Tarifa Meta + taxa de plataforma Twilio de US$0,005 por mensagem (~R$0,03). Sem mensalidade fixa obrigatória (pay-as-you-go). Exemplo real: 5.000 marketing + 3.000 service ≈ US$369/mês. | SDKs maduros em várias linguagens, webhooks bem documentados, boa DX | Sim | Processo Twilio + Meta, cerca de 1–2 semanas | Funciona bem para poucos milhares de msgs/mês; taxa por mensagem soma-se ao custo Meta, sem inbox multi-atendente pronta (exige construir) |
| **Gupshup** | Fee de plataforma baixo por mensagem (~US$0,001) mas pricing pensado para altíssimo volume (100k+ msgs/mês); abaixo disso o custo efetivo fica desproporcional | API robusta, mas onboarding/suporte voltado a operações grandes | Sim | Via parceiro | Overkill para o porte do escritório — desenhado para operação de massa |
| **Zenvia** | Plataforma SaaS de R$0 (Starter) a R$600+/mês (Specialist) + taxa de BSP de R$0,02–0,15/conversa + tarifa Meta. Exemplo: 10k marketing + 30k utility + 5k auth ≈ R$4.700/mês só de Meta | Plataforma completa de atendimento (inbox, filas, transferência entre setores) pronta, no-code | Sim | Sim, via parceiro | Cara e mais complexa do que o necessário para um volume de poucas centenas/milhares de conversas — mercado consultivo, foco em operações maiores |
| **Take Blip (Blip)** | Mensalidade mínima ~R$1.023/mês + custo Meta. Existe "Blip Go" gratuito para microempreendedores, mas com recursos limitados (sem API completa/webhooks customizados) | Plataforma robusta de multiatendimento e automação (BotBuilder), mas sem tabela pública de preços — cotação sob consulta | Sim | Via parceiro | Estrutura enterprise, preço de entrada alto para o porte do escritório |
| **APIs não oficiais (Z-API, Zapster, WPPConnect etc. via QR Code)** | Muito mais baratas (dezenas de R$/mês) | Fácil de integrar (não usa a API oficial da Meta) | **Não** — não há templates aprovados pela Meta, logo o requisito 2 (disparo fora da janela de 24h) fica inviável ou arriscado | Não passa pelo processo oficial da Meta | **Descartada**: alto risco de bloqueio do número (Meta endureceu a fiscalização em 2026, com banimentos quase instantâneos de conexões não autenticadas) e não atende ao requisito de template aprovado — inadequado para um sistema de produção de escritório de contabilidade |

## Requisitos comuns de verificação (todas as opções oficiais)

- Conta no Meta Business Manager com dados reais da empresa (CNPJ).
- Verificação de negócio: documento societário/CNPJ, comprovante de endereço, domínio/site.
- Número de telefone dedicado (não pode estar em uso no WhatsApp/WhatsApp Business pessoal) e passível de portabilidade posterior.
- Templates de mensagem (para o disparo proativo fora da janela de 24h) submetidos e aprovados pela Meta antes do uso — aprovação costuma levar minutos a poucas horas, mas pode ser rejeitada por violar políticas de conteúdo.

## Recomendação

**Meta Cloud API direta (self-service, sem BSP de markup) — ou, como alternativa de conveniência, 360dialog no plano Regular (~€49/mês) — combinada com a camada de atendimento (fila, transferência entre setores/atendentes) construída no próprio app Next.js que já está em desenvolvimento.**

Justificativa: o escritório tem porte pequeno/médio e volume moderado (poucas centenas/milhares de conversas/mês), então provedores voltados a operação de massa (Zenvia, Take Blip, Gupshup) cobram mensalidades e mínimos desproporcionais ao volume real. Como o time já está construindo o próprio sistema de atendimento (não precisa de um inbox pronto de terceiros), a rota mais econômica é ir direto na Cloud API da Meta — zero mensalidade de plataforma, paga-se só a tarifa por mensagem da Meta — ou, se quiser reduzir o atrito de verificação/homologação inicial, usar o 360dialog como BSP fino (sem markup nas tarifas da Meta, mensalidade fixa baixa e verificação mais rápida). APIs não oficiais (Z-API e similares) foram descartadas por não suportarem templates aprovados e pelo alto risco de bloqueio do número em produção.

## Sources

- [Preço da API Oficial do WhatsApp 2026 + Calculadora](https://www.nimochat.com.br/blog/geral/quanto-custa-api-oficial-whatsapp-waba-2026/)
- [Quanto Custa a API Oficial do WhatsApp? Umbler Blog](https://blog.umbler.com/br/quanto-custa-api-oficial-do-whatsapp/)
- [Twilio WhatsApp Pricing 2026: Fees, Rates & Real Cost](https://landbot.io/blog/twilio-whatsapp-pricing)
- [WhatsApp Messaging Pricing | Twilio](https://www.twilio.com/en-us/whatsapp/pricing)
- [360dialog Pricing](https://360dialog.com/pricing)
- [WhatsApp Business API Pricing 2026: Per-Message Rates](https://setsmart.io/blog/whatsapp-business-api-pricing)
- [Zenvia — Planos e Preços da Zenvia Customer Cloud](https://zenvia.com/en/prices/)
- [API Oficial vs Zenvia: qual vale mais a pena para WhatsApp em 2026?](https://apioficial.com.br/blog/api-oficial-vs-zenvia)
- [Preços Take Blip 2026: Vale a Pena para MEIs BR?](https://bossbot.uk/blog/take-blip-pricing-review-2026-pt)
- [Blip oferece solução no WhatsApp para micro empreendedores](https://www.mobiletime.com.br/noticias/17/02/2025/blip/)
- [Quanto Custa Automação de WhatsApp em 2026: de R$ 200 a R$ 1.000/mês](https://zaptrend.com.br/blog/quanto-custa-automacao-whatsapp/)
- [Gupshup WhatsApp API Pricing | Retentionly](https://retentionly.io/post/gupshup-whatsapp-api-pricing)
- [Z-API vs API Oficial - Z-API Docs](https://developer.z-api.io/tips/Z-APIvsAPI-OFICIAL)
- [API oficial vs. não oficial do WhatsApp: riscos e diferenças](https://zappycontabil.com.br/qual-a-diferenca-entre-api-oficial-e-nao-oficial-do-whatsapp/)
- [WhatsApp API Oficial vs Não Oficial 2026: Riscos e Diferenças](https://www.socialhub.pro/blog/whatsapp-api-oficial-vs-nao-oficial-riscos-diferenca/)
- [Get Started - WhatsApp Business Management API - Meta for Developers](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started/)
- [Guia Completo de Verificação da BM para WhatsApp Business](https://blog.devoficial.com.br/post/verificacao-da-bm-para-whatsapp-business)

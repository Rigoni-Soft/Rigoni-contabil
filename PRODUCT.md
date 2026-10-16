# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Funcionários, Líderes de setor e Admin da Rigoni Contábil, um escritório de contabilidade de porte pequeno/médio (~1.000 clientes, 1.000+ CNPJs entre matriz e filiais, 10 setores, 3 cidades pequenas/médias). Nesta rodada, o único setor com dashboard e cadastro é o Simples Nacional; o Painel do Funcionário (conduzir o Atendimento por WhatsApp) vale para todos os setores, e os demais setores ainda não têm tela de gestão própria.

Indiretamente, os clientes do escritório (empresas atendidas) interagem com o sistema pelo WhatsApp, sem acessar nenhuma tela — a experiência deles é 100% conversacional (URA + atendente humano).

## Product Purpose

Substituir o atendimento manual por WhatsApp (sem fila, sem histórico estruturado, sem transferência rastreável entre setores) e o controle do setor Simples Nacional feito à mão numa planilha (`CONTROLE SIMPLES NACIONAL`) por um sistema único: atendimento com URA, fila e balanceamento entre funcionários, e um dashboard/cadastro que dá visão consolidada de documentos, DAS e parcelamentos.

## Positioning

Ferramenta interna proprietária, não um produto de mercado. O que a diferencia da situação atual (planilha + atendimento manual) é: atendimento com fila e transferência rastreável entre 10 setores, RBAC real (Admin/Líder de setor/Funcionário), trilha de auditoria completa de ações e conversas, e integração automática com o Serpro (Integra Contador) e a API oficial do WhatsApp Business.

## Operating Context

- Escritório de contabilidade brasileiro, atendendo clientes majoritariamente do regime Simples Nacional nesta rodada (Regime também aceita Lucro Presumido/Lucro Real/MEI para uso futuro).
- Atendimento via WhatsApp Business API (Meta Cloud API direta, ou 360dialog como BSP fino — ver `docs/pesquisa/whatsapp-bsp.md`), com templates Utility aprovados pela Meta para disparos fora da janela de 24h.
- Integração com o Serpro via produto Integra Contador (DAS, parcelamento, CND), autenticada com certificado digital e-CNPJ do escritório; depende de procuração eletrônica e-CAC vigente por cliente (processo manual da equipe, fora do sistema).
- Setores do sistema seguem o organograma real do escritório (RH, Tributário, Simples Nacional, Contábil, Societário, Condomínios, Financeiro, Administrativo, Recepção), excluindo Patriki e Expedição; Contábil Externo é o mesmo Setor que Contábil, T.I. cai dentro de Administrativo — nenhum dos dois é Setor próprio (ver `CONTEXT.md`, termo "Setor").

## Capabilities and Constraints

- RBAC por Papel (Admin, Líder de setor, Funcionário) e Setor; Admin acessa tudo, os demais só o próprio setor.
- Quatro módulos de domínio: `usuarios` (RBAC/autenticação), `clientes` (cadastro básico por Admin + Cadastro operacional automático pra Regime Simples Nacional/MEI, editado pelo Funcionário do Simples Nacional — DAS, parcelamento, contrato social), `atendimento` (URA, fila, transferência, balanceamento mensal, Painel do Funcionário), `auditoria` (registro + consulta).
- Nenhuma tela do setor Simples Nacional exibe contrato social ou alterações contratuais — mesmo o cadastro de outros setores é só leitura.
- Terminologia do domínio fixada em `CONTEXT.md` (Setor, Papel, Atendente, URA, Cliente, Regime, Contato, Atendimento, Mensagem, Fila, Transferência, Balanceamento mensal, Atividade do mês) — qualquer trabalho futuro deve usar esses termos, sem sinônimos novos.
- Spec funcional completa e os 27 tickets de implementação vivem no issue tracker do GitHub (`Rigoni-Soft/Rigoni-contabil`, issue #24 e filhos #28–#54), não neste arquivo.
- Requisitos não-funcionais dimensionados para o porte real do escritório: ~50 usuários simultâneos, ~20 rps (pico ~50), 95% de disponibilidade.

## Brand Commitments

- Nome do produto/empresa: **Rigoni Contábil**.
- Identidade visual: **"Talão de Cheque"** — ver `DESIGN.md` (raiz do repositório) para tokens, tipografia e o padrão de guilhochê. Uma primeira paleta (teal + sand, dark mode verde-oliva) foi prototipada e depois rejeitada pelo usuário; "Talão de Cheque" é a direção vigente desde 25/09/2026 (confirmada por Cledson, substituindo a paleta anterior aprovada na issue #22), já aplicada ao login/shell (#28) e ao contrato de `.impeccable/surfaces/dashboard-simples-nacional.md`.
- Fonte obrigatória por convenção técnica do time (não é decisão de marca, é regra de arquitetura já fixada): Roboto, única família do projeto (`docs/arquitetura.md` §5.3). Paleta e demais tokens visuais seguem tokens semânticos, tons pastel e temas dark/light obrigatórios (mesma seção) — dentro dessas regras técnicas, a direção de cor específica está aberta pro redesign.

## Evidence on Hand

- `docs/referencia/ORGANOGRAMA.pdf` — estrutura real de setores e líderes.
- `docs/referencia/CONTROLE SIMPLES NACIONAL .xlsx...pdf` — planilha real hoje usada pelo setor Simples Nacional (base do novo cadastro).
- `docs/referencia/contratos/` — exemplos reais de contrato social e alterações contratuais.
- `docs/pesquisa/whatsapp-bsp.md` e `docs/pesquisa/serpro-api.md` — pesquisas concluídas sobre os provedores externos.
- `docs/pesquisa/templates-whatsapp.md` — conteúdo aprovado dos 3 templates WhatsApp Utility.
- Spec completa: issue #24 do GitHub (`Rigoni-Soft/Rigoni-contabil`). Mapa de decisões: issue #3.
- Protótipo anterior do dashboard Simples Nacional (paleta agora rejeitada, layout de seções ainda válido): https://claude.ai/artifact/7vyw2ciurffTQAraFtPdr9

## Product Principles

1. RLS no Postgres nunca substitui a checagem de autorização no caso de uso — são duas camadas, sempre as duas.
2. Nenhum dado de contrato social/alterações aparece fora das telas explicitamente autorizadas (hoje: cadastro pelo Admin); nunca em telas do Simples Nacional.
3. Falha de integração externa (Serpro, WhatsApp) tenta de novo automaticamente algumas vezes antes de virar alerta pra um humano — nunca alarme na primeira falha, nunca silêncio permanente.
4. Toda ação que muda estado é auditável (ator, data/hora, setor, alvo, resultado); leituras não são auditadas.
5. O sistema reflete o estado de processos externos (procuração eletrônica, aprovação de template) — nunca tenta automatizá-los ou contorná-los.

## Accessibility & Inclusion

Nenhuma exigência formal documentada (não é WCAG AA obrigatório nesta rodada). Segue boas práticas padrão: contraste adequado, foco visível, navegação por teclado.

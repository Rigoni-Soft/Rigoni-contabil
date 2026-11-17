# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Funcionários, Líderes de setor e Admin da Rigoni Contábil, um escritório de contabilidade de porte pequeno/médio (~1.000 clientes, 1.000+ CNPJs entre matriz e filiais, 10 setores, 3 cidades pequenas/médias). Nesta rodada, o Simples Nacional tem dashboard e cadastro, e o RH ganha o seu (acompanhamento mensal dos clientes e folha de ponto, issue #212), com o dashboard do SN virando o modelo de qualquer setor; a aba Atendimento (conduzir o Atendimento por WhatsApp) vale para todos os setores, e os demais setores ainda não têm tela de gestão própria.

No RH, o Funcionário opera os clientes de que é Responsável e o Líder acompanha a carteira e a equipe; o trabalho é mensal, por competência, e o resultado de cada cliente é concluído ou não por serviço (holerite, FGTS, DCTFWeb e demais). Os empregados dos clientes aparecem no sistema só pelo cartão de ponto e pelo quadro de funcionários do cliente.

Indiretamente, os clientes do escritório (empresas atendidas) interagem com o sistema pelo WhatsApp, sem acessar nenhuma tela — a experiência deles é 100% conversacional (URA + atendente humano).

## Product Purpose

Substituir o atendimento manual por WhatsApp (sem fila, sem histórico estruturado, sem transferência rastreável entre setores) e o controle do setor Simples Nacional feito à mão numa planilha (`CONTROLE SIMPLES NACIONAL`) por um sistema único: atendimento com URA, espera do Setor em que a equipe assume o cliente, e um dashboard/cadastro que dá visão consolidada de documentos, DAS e parcelamentos.

## RH (decisões confirmadas, issue #212)

- O RH acompanha por mês, por cliente, serviços definidos pelo Líder do RH; o Holerite é derivado dos cartões de ponto dos empregados do cliente. O Funcionário ganha um ponto por cliente totalmente concluído; o gráfico por funcionário é só do Líder e do Admin.
- A folha de ponto usa a convenção coletiva do sindicato do cliente (PDF anual, histórico guardado), lê fotos de cartões e atestados e entrega um PDF individual com a totalização em destaque para assinatura física.
- Dado pessoal de empregado de cliente: só nome, jornada, batidas, marca de comissionado e abono; imagens, CID e documentos nunca são guardados.

## Navegação e Avatar (decisões confirmadas, issue #270)

- O avatar do cabeçalho é o único caminho de volta à home em todas as telas autenticadas: leva a `/`, que cada Papel resolve (dashboard do Setor para Simples Nacional e RH; busca geral para o Admin e para os Setores sem tela). Não abre menu; Meu perfil e Sair seguem no menu de ações. Sem avatar na troca obrigatória de senha.
- Avatar: foto enviada em Meu perfil, senão logo do Setor, senão logo do escritório (arquivos estáticos em `public/logos/`); o Admin vê sempre a do escritório; sem inicial de reserva.
- A foto do Funcionário é dado pessoal guardado de propósito (ADR 0012): só o dono a vê, é removível a qualquer momento e apagada ao desativar o usuário; nunca versionada.
- Entrega em duas fatias antes do corte de 04/12/2026: Fatia 1 (avatar-link e logos, sem banco) obrigatória; Fatia 2 (upload de foto) tudo ou nada.

## Contatos por cliente e envio por setor (decisões confirmadas, spec #283)

- O Contato do Cliente tem nome, WhatsApp e e-mail (nome obrigatório, ao menos um dos dois canais), pertence a um único Cliente e a um ou mais Setores; não existe "Contato padrão". "URA" é só rótulo em todo Contato. O Setor que cadastra é o dono e só ele (e o Admin) edita nome, WhatsApp e e-mail; os outros Setores escolhem o Contato e definem só o seu canal e tipo de envio.
- Cada Setor define, por Cliente, os seus Destinos de envio (Contato, tipo de envio, canal); os envios automáticos do SN e do RH leem esses Destinos. Sem Destino válido o job avisa, uma vez, o Líder e o Responsável do Setor (sino) e abre o alerta do Setor.
- No "editar cadastro", o campo de contatos de cada Setor é uma tabela de Destinos com um select de contato já cadastrado (nome e e-mail se preenchem) e um botão "Novo contato" à direita do select; protótipo vencedor: variação A (ticket #282).
- A Recepção cadastra o Contato do número não encontrado pela URA, no atendimento, depois de confirmar o Cliente; só cria Contato URA.
- Entra inteira neste deploy (sem corte por prazo); as quatro entregas vão juntas a produção, e o SN precisa cadastrar os Destinos antes da primeira rodada do job depois do deploy.
- Dado pessoal: nome, WhatsApp e e-mail de Contato são dados pessoais; só dados fictícios em specs, issues, testes e exemplos.

## Positioning

Ferramenta interna proprietária, não um produto de mercado. O que a diferencia da situação atual (planilha + atendimento manual) é: atendimento com fila e transferência rastreável entre 10 setores, RBAC real (Admin/Líder de setor/Funcionário), trilha de auditoria completa de ações e conversas, e integração automática com o Serpro (Integra Contador) e a API oficial do WhatsApp Business.

## Operating Context

- Escritório de contabilidade brasileiro, atendendo clientes majoritariamente do regime Simples Nacional nesta rodada (Regime também aceita Lucro Presumido/Lucro Real/MEI para uso futuro).
- Atendimento via WhatsApp Business API (Meta Cloud API direta, ou 360dialog como BSP fino — ver `docs/pesquisa/whatsapp-bsp.md`), com templates Utility aprovados pela Meta para disparos fora da janela de 24h.
- Integração com o Serpro via produto Integra Contador (DAS, parcelamento, CND), autenticada com certificado digital e-CNPJ do escritório; depende de procuração eletrônica e-CAC vigente por cliente (processo manual da equipe, fora do sistema).
- Setores do sistema seguem o organograma real do escritório (RH, Tributário, Simples Nacional, Contábil, Societário, Condomínios, Financeiro, Administrativo, Recepção), excluindo Patriki e Expedição; Contábil Externo é o mesmo Setor que Contábil, T.I. cai dentro de Administrativo — nenhum dos dois é Setor próprio (ver `CONTEXT.md`, termo "Setor").

## Capabilities and Constraints

- RBAC por Papel (Admin, Líder de setor, Funcionário) e Setor; Admin acessa tudo, os demais só o próprio setor.
- Quatro módulos de domínio: `usuarios` (RBAC/autenticação), `clientes` (cadastro básico por Admin + Cadastro operacional automático pra Regime Simples Nacional/MEI, editado pelo Funcionário do Simples Nacional — DAS, parcelamento, contrato social), `atendimento` (URA, espera do Setor dirigida ao Responsável do Cliente ou ao Líder — comum só na Recepção —, supervisão de Líder/Admin, transferência, aba Atendimento), `auditoria` (registro + consulta).
- O contrato social e as alterações contratuais só são abertos, somente leitura, pelo Admin, pelo Líder do Setor Simples Nacional e pelo Funcionário Responsável do Cliente no Simples Nacional (cartão no formulário de editar, #140: a alteração de maior nº, ou o contrato social, já aparece com data e o botão "Abrir em nova aba", que abre o arquivo no primeiro clique, sem diálogo; a mais recente, sem escolher outra, ou, quando se chega por um aviso de nova alteração, a alteração daquele aviso, com o botão em foco e destacado, #144); outros Setores e Funcionários não Responsáveis não os veem — o cadastro de outros setores é só leitura. Só o Admin anexa uma nova alteração a um Cliente existente (botão "Anexar alteração" ao lado de "Abrir em nova aba", em `/clientes/[id]`, com nº, data e arquivo de até 4 MB, #141; sem seção de lista abaixo do formulário); o Admin que escolhe um Cliente na busca vai direto a essa tela própria.
- Os Avisos de cadastro (novo Cliente, nova alteração) vão só aos Setores (Líder do Setor Simples Nacional e Responsável do Cliente), por um sino no cabeçalho com contador e modal (#142, #143); o Admin não recebe aviso nem vê o sino.
- Terminologia do domínio fixada em `CONTEXT.md` (Setor, Papel, Atendente, URA, Cliente, Regime, Contato, Destino de envio, Tipo de envio, Atendimento, Mensagem, Espera, Transferência, Atividade do mês) — qualquer trabalho futuro deve usar esses termos, sem sinônimos novos.
- Spec funcional completa e os 27 tickets de implementação vivem no issue tracker do GitHub (`Rigoni-Soft/Rigoni-contabil`, issue #24 e filhos #28–#54), não neste arquivo.
- Requisitos não-funcionais dimensionados para o porte real do escritório: ~50 usuários simultâneos, ~20 rps (pico ~50), 95% de disponibilidade.

## Brand Commitments

- Nome do produto/empresa: **Rigoni Contábil**.
- Identidade visual: **"Talão de Cheque"** — ver `DESIGN.md` (raiz do repositório) para tokens, tipografia e o padrão de guilhochê. Uma primeira paleta (teal + sand, dark mode verde-oliva) foi prototipada e depois rejeitada pelo usuário; "Talão de Cheque" é a direção vigente desde 25/09/2026 (confirmada por Cledson, substituindo a paleta anterior aprovada na issue #22), já aplicada ao login/shell (#28) e ao contrato de `.impeccable/surfaces/dashboard-simples-nacional.md`.
- Fonte obrigatória por convenção técnica do time (não é decisão de marca, é regra de arquitetura já fixada): Roboto, única família do projeto (`docs/arquitetura.md` §5.3). Paleta e demais tokens visuais seguem tokens semânticos, tons pastel e temas dark/light obrigatórios (mesma seção) — dentro dessas regras técnicas, a direção de cor específica está aberta pro redesign.

## Evidence on Hand

- Planilha de acompanhamento do RH (`09.2026.xlsx`), planilha de cartão de ponto (`PLANILHA CARTAO PONTO 09.2026.xlsx`), convenção coletiva de exemplo e fotos de cartões e atestados: ficam fora do repositório (têm dados pessoais); a spec do RH (issue #212) e o mapa (#208) registram o que se aprendeu com eles.

- `docs/referencia/ORGANOGRAMA.pdf` — estrutura real de setores e líderes.
- `docs/referencia/CONTROLE SIMPLES NACIONAL .xlsx...pdf` — planilha real hoje usada pelo setor Simples Nacional (base do novo cadastro).
- `docs/referencia/contratos/` — exemplos reais de contrato social e alterações contratuais.
- `docs/pesquisa/whatsapp-bsp.md` e `docs/pesquisa/serpro-api.md` — pesquisas concluídas sobre os provedores externos.
- `docs/pesquisa/templates-whatsapp.md` — conteúdo aprovado dos 3 templates WhatsApp Utility.
- Spec completa: issue #24 do GitHub (`Rigoni-Soft/Rigoni-contabil`). Mapa de decisões: issue #3.
- Protótipo anterior do dashboard Simples Nacional (paleta agora rejeitada, layout de seções ainda válido): https://claude.ai/artifact/7vyw2ciurffTQAraFtPdr9

## Product Principles

1. RLS no Postgres nunca substitui a checagem de autorização no caso de uso — são duas camadas, sempre as duas.
2. Nenhum dado de contrato social/alterações aparece fora de quem a regra do banco autoriza (Admin, Líder do Setor Simples Nacional, Responsável do Cliente); a tela recebe só tipo, nº e data, nunca o caminho do arquivo, e o link assinado nasce no clique.
3. Falha de integração externa (Serpro, WhatsApp) tenta de novo automaticamente algumas vezes antes de virar alerta pra um humano — nunca alarme na primeira falha, nunca silêncio permanente.
4. Toda ação que muda estado é auditável (ator, data/hora, setor, alvo, resultado); leituras não são auditadas.
5. O sistema reflete o estado de processos externos (procuração eletrônica, aprovação de template) — nunca tenta automatizá-los ou contorná-los.
6. O que só o sistema sabe, só o sistema grava: DAS "enviado" e a data de envio resultam da entrega aceita pelo job (#52) e nenhuma pessoa os define, nem Admin. A trava está no banco, e a tela só exibe (#108).

## Accessibility & Inclusion

Nenhuma exigência formal documentada (não é WCAG AA obrigatório nesta rodada). Segue boas práticas padrão: contraste adequado, foco visível, navegação por teclado.

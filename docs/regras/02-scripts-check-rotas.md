# Regras tiradas dos comentários: scripts, check de rotas, env, factories e páginas

Conhecimento que vivia em comentários e agora mora aqui (o código ficou sem comentário).

## check:rotas
`route.ts` em `src/app` só existe para webhooks de terceiros, jobs agendados e a leitura da foto do avatar (ADR 0012). Toda outra comunicação cliente-servidor é Server Action.
Onde vive: scripts/check-rotas.mjs (docs/arquitetura.md premissa 1 e seção 3.13); teste em scripts/check-rotas.spec.ts.

## check:specs
Todo Container, molecule e organism precisa de `*.spec.tsx` ao lado (docs/testes.md §4.1). Os sem spec ficam em scripts/specs-sem-teste.baseline.txt, que só encolhe; `yarn check:specs --gerar-baseline` reescreve a lista.
Onde vive: scripts/check-specs-views.mjs.

## check:guard-senha
Toda page autenticada sob `src/app` chama `exigirSessao()`/`validarSessao()` (shell.server), que aplicam o redirect de troca obrigatória de senha, em vez de um layout/guard comum; o script é a rede de segurança contra bypass em rota nova. Páginas públicas (só o login) ficam fora; `/trocar-senha` carrega a sessão mas não checa `precisaTrocarSenha` contra si mesma. `classificarPagina` é pura para ser testada sem disco, e a varredura só roda quando o arquivo é executado como script.
Onde vive: scripts/check-troca-senha-guard.mjs:classificarPagina; teste em scripts/check-troca-senha-guard.spec.ts.

## ffmpeg comprimido
Antes do build o binário do `ffmpeg-static` (dezenas de MB) é comprimido em brotli para a função da conversa de áudio levar só o comprimido; em runtime `resolver-ffmpeg` o descomprime em /tmp. Sem o pacote ou o binário, nada acontece e o app usa o do pacote/PATH. Na factory: `FFMPEG_PATH` manda, depois o comprimido, depois o do pacote/PATH; o import do pacote é dinâmico porque no deploy ele sai do trace. ADR 0006.
Onde vive: scripts/comprimir-ffmpeg.mjs; src/main/atendimento.factory.ts (resolução do ffmpeg).

## medir:leitura (leitor de cartão)
Usa a API de visão de verdade (custa por foto). Uso: `yarn medir:leitura <pasta> [AAAA-MM]` (padrão 2026-09); a quinzena sai do nome do arquivo (`...quin-1.jpeg`). Imprime só números e o nome lido, nunca grava foto; o nome do atestado só com NOMES=1 (dado pessoal); CID e documento nunca são pedidos. O script mapeia o alias `@/` para `src/` e acrescenta `.ts` porque o Node não resolve ambos. `EFORCO` injeta esforço no corpo; Sonnet 5.5 recusa `tool_choice` forçado, então a instrução já pede só a ferramenta.
Onde vive: scripts/medir-leitura-cartao.mjs.

## seed Teste Zap
Cria o Cliente "Teste Zap" como o cadastro do app: PDFs no bucket `documentos-clientes`, caminhos gravados pela RPC `criar_cliente`, contatos; idempotente. Roda após o `db reset` da homologação (e2e-preview.yml) ou com `node --env-file=.env.local scripts/seed-teste-zap.mjs`. Só aceita Supabase local ou o projeto `SUPABASE_HOMOLOG_PROJECT_REF`. O CNPJ é fictício com dígitos verificadores válidos. O upload é remove + upload (sem `upsert`), como o app, porque o ON CONFLICT do upsert falha no Storage local.
Onde vive: scripts/seed-teste-zap.mjs.

## env.ts: guardas e variáveis
- `PORT` não entra: só `next dev/start` e o Playwright a leem; exigi-la quebraria build/deploy em que a plataforma define a porta.
- `NODE_ENV` vem do Next (production também na Vercel Preview); regras de produção leem dele, não de process.env.
- Obrigações fiscais: mock em mock-api/ por padrão; modo `serpro` exige Consumer Key/Secret e certificado e-CNPJ (.p12 em base64 + senha). Ambiente `trial` (token fixo, sem certificado; Preview/homolog) ou `producao` (OAuth2 + e-CNPJ); define URLs padrão, sobrescrevíveis. CND é outro produto do Serpro, com chave própria e modo independente. Docs: docs/deploy/serpro.md.
- Trial devolve dado de demonstração: em Production da Vercel "enviaria" guias falsas a Clientes reais, então é recusado.
- Mensageria (docs/contratos/mensageria.md): falsa por padrão; segredos do webhook falsos só em dev (a factory recusa em produção). HMAC do telefone na sessão da URA tem chave própria para que trocar um segredo não invalide o outro. O segredo dos e2e para usar o adapter falso num deploy real só existe em Preview/homolog; Production recusa. Cloud API (Meta) só exigida com `MENSAGERIA_MODO=real`.
- `CRON_SECRET`: bearer das rotas de job; sem valor elas recusam tudo.
- Flags de job (encerramento automático 23h50 após a última Mensagem do cliente, lembrete de documento/DAS, lembretes PGFN) são desligadas por padrão; ter o segredo não basta. Encerramento e PGFN não falam com o Cliente e não exigem mensageria real.
- E-mail: falso por padrão; real é SMTP Gmail com senha de app (conta com verificação em duas etapas) e `from` como "Rigoni Contábil <conta@gmail.com>".
- Leitores: PDF de parcelamento falso ou `texto`; convenção coletiva falsa ou `indisponivel` (Produção hoje); foto do cartão falsa, `indisponivel` (digitação manual) ou `visao` (exige ANTHROPIC_API_KEY, docs/deploy/leitura-de-cartao.md). Leitores falsos gravam dado inventado: em Production a variável deve ser escolhida, nunca herdar `falso`.
- WhatsApp do financeiro (só dígitos, com DDI), destino das guias de parcelamento interno: ausente ou inválido não derruba o app; o job não envia o interno, segue pendente e abre o alerta `financeiro_ausente`.
Onde vive: src/env.ts; teste em src/env.spec.ts (guardas de Production; o módulo valida ao importar, então cada caso o carrega do zero).

## Factories do main: sessão e circularidade
O `main` adapta a sessão do módulo usuarios à porta própria de cada módulo (atendimento, auditoria, clientes, rh; arquitetura.md 3.11), montando o ObterSessao direto, sem chamar usuarios.factory, para não criar import circular (usuarios.factory também precisa da auditoria). Papel e Setor já vêm validados pelo builder do módulo usuarios: o cast é a única fronteira.
Onde vive: src/main/*.factory.ts (funções de sessão).

## Auditoria com service_role
A RPC `registrar_acao_auditoria` só aceita service_role (migration 20260924190000_usuarios_e_auditoria.sql), para um usuário comum não fabricar eventos; privilégio elevado confinado a um ponto (ADR 0001). A auditoria é best-effort: falha vai para o registro de erros sem derrubar a ação.
Onde vive: src/main/auditoria.factory.ts.

## Webhook público e jobs
Nenhum caminho da rota pública (GET/POST) chega ao client privilegiado nem valida HMAC com segredo de desenvolvimento em produção. Jobs rodam com service_role, sem sessão de usuário, e só agem com a flag ligada e, quando falam com o Cliente, em produção só com mensageria real (o adapter falso "enviaria" sem avisar ninguém); autenticar o job com CRON_SECRET não autoriza executá-lo. E-mail falso em produção responderia ok sem enviar: sem EMAIL_MODO=real o canal falha explicitamente. Requisição de e2e pode pedir o adapter falso por cabeçalho secreto mesmo com deploy real (pedeAdapterFalsoDoE2E). O adapter falso de mensageria é instância única e guarda em memória o que "enviou". O cadastro por Recepção roda com a sessão do usuário (o banco confere Recepção e dono do Atendimento); só a leitura do Cliente por CNPJ usa service_role. Feriados e anexos usam o client da sessão para valer RLS e auditoria; upload-de-anexo roda no navegador (sem server-only) com a sessão do cookie que o middleware renova.
Onde vive: src/main/atendimento.factory.ts; teste src/main/atendimento.factory.test.ts (fail-open do webhook: segredos ausentes ou iguais ao placeholder impedem HMAC e a criação do client privilegiado); src/main/client/upload-de-anexo.factory.ts.

## Storage e RLS em clientes.factory
Bucket de acordos PGFN é privado, sem política de usuário: o PDF sobe e some pelo service_role depois de o caso de uso checar o papel; linhas do banco seguem pela sessão do usuário (RLS decide o Responsável). Guia da parcela usa o mesmo bucket com prefixo por Parcelamento e competência. Link assinado vem do service_role sobre caminho lido pela sessão. Avisos: cada um só vê e marca os próprios (RLS). Leitor do PDF: falso por padrão (dev, CI, Preview), `texto` lê a camada de texto no servidor.
Onde vive: src/main/clientes.factory.ts.

## Serpro por ambiente
URLs por ambiente em docs/deploy/serpro.md; token público de demonstração da documentação só vale no trial; o código da CND vem dos exemplos do trial; a instância no modo real é única para guardar o token entre chamadas.
Onde vive: src/main/obrigacoes-fiscais.factory.ts.

## Renovação de sessão
`getUser()` (não `getSession()`) valida o token no servidor, o que de fato renova a sessão quando o access token expirou.
Onde vive: src/main/renovar-sessao.factory.ts.

## RH factory
Um client Supabase só por caso de uso da Folha (leitura e restante dividem sessão e repositório); cartão e atestado leem pelo mesmo leitor; PDF e convenção vão com a sessão do usuário, e policy do bucket e RLS repetem a regra do caso de uso.
Onde vive: src/main/rh.factory.ts.

## Acesso por Setor e papel nas páginas
- Resumo de Setor é exclusivo do Simples Nacional (mesmo critério de app/page.tsx); Admin vê qualquer setor (suporte); funcionário de outro setor volta ao início. Só Admin ou Funcionário do SN edita o cadastro operacional; o SN atribui no cadastro, o Líder dos demais Setores no bloco do Setor.
- Admin nunca é desativado nem muda de papel pela UI. O Admin não pertence a um Setor (Atendimento começa pelo primeiro). O escopo de usuários é feito por RBAC no caso de uso (Admin tudo, Líder o próprio Setor). Senha provisória: o fluxo obrigatório tem prioridade sobre o perfil; `/trocar-senha` só a obrigatória, a voluntária é do perfil.
- Home "/" é genérica; cada Setor tem seu dashboard (SN em /simples-nacional, RH em /rh); Admin fica em "/" com busca geral e alcança qualquer setor pela aba do ShellNav.
- Falha de leitura não é Cliente inexistente (só este vai ao início); falha de carga inicial do Atendimento não expulsa: a lista começa vazia e o polling recupera. Se a carga do servidor falha, o botão se lê por action com "Tentar novamente".
- No RH o Responsável e o acompanhamento ficam dentro do cartão do formulário; o Líder atribui, o Responsável vê. O acompanhamento do mês do RH no painel do Cliente usa sempre o mês corrente e some quando o mês é inválido ou o ator não vê o RH; sem Responsável, os serviços vêm bloqueados. Os serviços do acompanhamento definem os cards do dashboard do RH; só o Líder os mantém.
- Duplicação conhecida: o esqueleto de resumo repete em app/rh/resumo/[bucket] e app/clientes/resumo/[bucket]; extrair um helper por Setor quando houver o 3º Setor com resumo (Contábil). O carregamento do RH repete o de app/rh/resumo/[bucket] porque app só tem arquivos do Next. A carteira do RH é lida inteira para achar o Cliente; filtrar no repositório se pesar. O "Voltar" da tela do Cliente volta ao mês atual, sem o ?mes= consultado.
Onde vive: src/app/**/page.tsx.

## Rotas com leitor de foto (maxDuration)
As Server Actions que leem foto do cartão e do atestado rodam nas rotas da Folha e do Cartão e esperam o leitor até 45 s: a função precisa viver mais que isso, senão a plataforma a mata antes de a tela cair na digitação manual/abono à mão. O Cartão do empregado mostra o mês inteiro em tabela larga (janela toda); a key recomeça as linhas abertas a cada mês e empregado.
Onde vive: src/app/rh/folha-de-ponto/[cliente]/page.tsx e .../cartao/[empregado]/page.tsx (maxDuration).

## Error boundary e layout
`error.message` não é mostrado: no servidor é genérico e no cliente pode vazar detalhe interno. A fonte Roboto vem do repositório, não do Google, para o build não depender de rede. O contador e o aviso sonoro ficam no layout para persistir entre telas.
Onde vive: src/app/error.tsx; src/app/layout.tsx.

## globals.css
Tokens "Talão de Cheque": verde-cheque como acento, papel creme no claro, selo dourado para "em dia", vermelho para urgente; dark é o padrão (docs/arquitetura.md 5.1), neutros quentes (~47°, ~7% de saturação). Justificativa e contrastes AA em DESIGN.md. Guilhochê só em cards de destaque e painel do cliente, via mask-composite. Conteúdo oculto até hidratar tem saída de emergência: se o React não hidratar, uma animação de 0s revela após 3 s (só troca visibility). O atraso de carregamento só esconde no primeiro quarto de segundo, sem movimento. Véu de diálogo usa tinta do tema, não preto puro. Animações só com `motion-safe:`.
Onde vive: src/app/globals.css; DESIGN.md.

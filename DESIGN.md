
# DESIGN.md — Rigoni Contábil

Sistema de design estabelecido nesta rodada pela primeira UI real do produto
(login + shell autenticado, ticket #28). Toda superfície futura parte destes
tokens e componentes em vez de reabrir a decisão de identidade visual.

## Direção: "Talão de Cheque"

THESIS: cada tela trata a confiança como o guilhochê de um talão de
cheque — a moldura de segurança de um documento financeiro, não o clichê de
cofre/escudo de "SaaS financeiro". Ver `.impeccable/surfaces/dashboard-simples-nacional.md`
para o contrato completo (aprovado pelo usuário; esta rodada aplica a mesma
direção ao login e ao shell).

Modo: **Operate**. Densidade previsível, hierarquia estável, cor reservada
para ação e estado — nunca decoração.

## Tokens

Definidos como CSS variables em `src/app/globals.css`, no formato exigido
pelo shadcn (`docs/arquitetura.md` §5.1). `:root` carrega os valores do tema
dark; a classe `.light` sobrescreve para o tema **claro (padrão do produto,
decisão revisada em 2026-09-30)**. `next-themes`
(`src/presentation/providers/theme.provider.tsx`) alterna a classe em
`<html>`; `enableSystem` fica desligado para não sobrepor "light é o padrão"
com a preferência de SO do visitante.

| Token | Dark | Light (padrão) | Uso |
|---|---|---|---|
| `background` / `foreground` | `#23221f` / `#ece7d8` | `#f4f1e8` / `#16231f` | tela |
| `card` / `card-foreground` | `#2c2a26` / `#ece7d8` | `#faf8f1` / `#16231f` | superfícies elevadas (cartão de login, painel de filtro, cartão de confirmação) |
| `primary` / `primary-foreground` | `#54a292` / `#0a1613` | `#0d3b36` / `#f4f1e8` | verde-cheque — ação principal, e estado "sucesso" em listas/feeds e confirmações |
| `secondary`, `muted`, `accent` | tons de papel/verde desaturados | idem | hierarquia secundária, hover |
| `destructive` / `destructive-foreground` | `#e0968c` / `#2a0f0c` | `#7a2b2b` / `#f4f1e8` | erro/atenção — sempre com ícone, nunca só cor; também estado "falha" em listas/feeds |
| `success` / `success-foreground` | `#d9bd7c` / `#2a1f0c` | `#96742f` / `#2a1f0c` | selo dourado "em dia" — reservado especificamente para as telas de status do Simples Nacional (#35–#37); não usar para resultado sucesso/falha genérico (isso é `primary`/`destructive`, ver Componentes → Indicadores de estado). Só em traço/ícone: no claro tem 3,8:1 sobre `background`, abaixo dos 4,5:1 de texto |
| `border` / `ring` | `#47453e` | tons de contorno derivados do verde | bordas decorativas, foco |
| `input` | `#7a7765` | `#857d66` | contorno de campo, select, textarea, botão outline e painel de emoji: ≥3:1 sobre `background` e `card` nos dois temas (WCAG 1.4.11) |
| `overlay` | `#0f0e0c` a 70% | `#16231f` a 55% | véu atrás de diálogos nativos (`popover`: imagem ampliada, prévia de documento) — tinta de cada tema, não preto puro; só escurece o fundo, não carrega texto |

**Dark "leve":** a paleta dark original
(`background` `#0c1512`, luminância relativa ~0,6%) lia como sombria demais —
pedido do usuário foi uma dark mais leve/suave, na mesma identidade da light.

1ª tentativa: subiu a luminância de fundo pra ~1,75% mantendo o matiz
verde-carvão original (hue 156°, sat 15%) — ainda leu "pesado"/contraste
intenso pro usuário, porque o problema não era só luminância, era o matiz
saturado de verde competindo com o `primary`.

2ª tentativa (a vigente): os neutros (`background`, `card`, `secondary`,
`muted`, `accent`, `border`) saem do matiz verde e vão pro mesmo matiz quente
do papel da light (~47°, contra 45° da light) só que quase sem saturação
(~7%, contra os 9-35% da light) — grafite de verdade, não carvão. A
luminância de fundo se mantém em ~1,75% (não mudou de novo, só o matiz/
saturação). `primary`/`destructive`/`success` não mudaram: são os acentos de
cor de propósito, o problema era só nos neutros competindo com eles. Todos
os pares texto/fundo reverificados (WCAG): o pior caso (`primary` como texto
sobre `background`) ficou em 5,27:1, folgado acima do mínimo AA de 4,5:1 pra
texto de corpo.

`primary-foreground` do dark theme usa tinta quase-preta (não branco): o
verde-cheque claro (#54a292) atinge ~6,1:1 de contraste com texto escuro
contra bem menos com branco — medido e escolhido por esse motivo, não por
hábito.

`--radius` = `0.375rem` — deliberadamente mais quadrado que o padrão do
shadcn (0.625rem), reforçando a leitura de "documento oficial" em vez de
pílula arredondada de SaaS.

## Tipografia

Roboto é a única família do projeto (`docs/arquitetura.md` §5.3, regra
técnica não negociável), carregada via `next/font/google` em
`src/app/layout.tsx` e exposta como `--font-sans`. Pesos 400/500/700.

## Guilhochê

`.rc-guilloche-frame` (`src/app/globals.css`) é a moldura de segurança do
mundo "Talão de Cheque": duas grades de linhas finas em ângulos opostos,
recortadas para viver só na faixa de borda via `mask-composite: exclude` —
sem asset de imagem, tileable, 100% CSS. Usada com moderação: cartão de
login e, desde #35, o próprio formulário de cadastro operacional
(`editar-cadastro-operacional-form.component.tsx`) — o painel de cliente
do dashboard Simples Nacional, tanto na página dedicada `/clientes/[id]`
quanto no uso inline da busca (`/`), lê como a folha do talão preenchida,
conforme o contrato de `.impeccable/surfaces/dashboard-simples-nacional.md`.
Qualquer outro painel de cliente futuro reusa a mesma moldura em vez de um
`border` simples.

## Layout

Telas Operate autenticadas (`ShellHeader` + conteúdo) usam um container
centralizado com padding lateral (`px-4 sm:px-6`); a largura é relativa à
tela (`%`, não `max-w-*` fixo), definida pela categoria da tela, não um
valor único fixo do produto (decisão revisada em 2026-10-01: `max-w-*` fixo deixava a tela "sobrando"
em monitores largos):

- **Login e troca de senha**: ficam de fora da regra — `max-w-sm`/`max-w-md`,
  conteúdo único centralizado, por serem telas de entrada/bloqueio, não de
  trabalho. Decisão explícita do usuário: nunca ocupam a tela toda.
- **Perfil** (`/perfil`, #56): `max-w-md`, como login/troca de senha; dados da conta em `<dl>` (rótulo
  `muted-foreground` / valor `font-medium`), seguidos da seção "Trocar
  senha" separada por `border-t`. Sem cartão: são dois blocos de leitura e
  formulário, não superfícies elevadas.
- **Formulário de cadastro/edição** (cadastro de Cliente, de Líder/Funcionário,
  Feriados e edição do cadastro operacional `/clientes/[id]`): largura `cadastro`,
  `w-full max-w-4xl` (56 rem). **Decisão de 21/10/2026, revisa a de `w-[80%]`**: em monitor
  largo 80% esticava campos e botões demais; o formulário passa a ter largura contida e se
  organiza em 2 a 4 colunas (ver "Cadastro de Cliente e documentos contratuais"). É a exceção à
  regra de `%` acima, por ser tela de preenchimento: a legibilidade do campo manda.
- **Conteúdo/listagem** (dashboard `/`, resumo do setor e seu drill-down
  `/clientes/resumo/[bucket]`, feed de auditoria `/admin/auditoria`): `w-[90%]` — telas de trabalho
  contínuo (ver, filtrar, navegar entre registros), ocupam a maior parte da
  largura livre da tela. A largura `formulario` (`w-[80%]`) segue no template, hoje sem uso.
- **Conversa do Atendimento** (`/atendimento/[id]`, #49): exceção à regra
  de `%`, por decisão do usuário (2026-10-08, "muito apertado no centro"):
  ocupa a tela toda, com só `px-4 sm:px-6 lg:px-8`. Em tela larga (`lg`) a
  página tem exatamente a altura da janela (`h-dvh`) e **não rola em
  nenhum sentido**; só a lista de mensagens rola, por dentro. Em tela
  estreita volta a ser uma página comum.

Formulário com elevação (edição do cadastro operacional do Simples Nacional, #34):
cartão `rounded-lg border bg-card p-5 shadow-sm` dentro do container `cadastro`, em 4 colunas
em tela larga (Forma de envio, Documento, DAS, Data de envio na mesma linha; ver
"Cadastro de Cliente e documentos contratuais").

Painel de filtro: campos em grid (`grid-cols-2 sm:grid-cols-4`), e as ações
(Limpar/Filtrar) ficam numa linha própria abaixo dos campos, separada por
`border-t` — nunca misturadas na mesma linha de grid que um campo de
entrada (ação e dado de filtro são grupos distintos).

## Componentes

Átomos próprios (o que o shadcn não oferece, sem estado nem hooks) vivem em
`src/presentation/components/atoms/` com sufixo `.component.tsx`:
`field-error`, `file-input`, `required-mark`, `titulo-de-grupo`, `grupo-de-acoes`.
Moléculas de formulário reaproveitáveis (`molecules/`): `campo-de-texto`,
`campo-de-opcoes` (rótulo + campo + erro/aviso, `aria-invalid`/`aria-required`
vindos das props), `confirmacao-de-cadastro`, `botao-de-envio`,
`acoes-do-formulario`, `linha-de-contato`, `linha-de-alteracao`,
`campo-responsavel`. Formulário novo compõe estas peças em vez de repetir
rótulo + campo + erro à mão. Gráficos do dashboard: `cartao-de-grafico` (átomo),
`donut-de-fatias` e `barras-de-fatias` (moléculas).

**Definição de cada nível (Atomic Design deste produto).** Átomo: o menor componente
da página (`ui/` + `atoms/`: `caixa` (+ `pilha`, `linha`, `grade`), `texto`, `link-de-acao`,
`celula-de-tabela`, `botao-de-emoji`…). Molécula: pequeno componente
reaproveitável **composto por 2 ou mais átomos** (`campo-de-texto`,
`mensagem-balao`, `item-da-fila`, `cabecalho-de-tela`…). Organismo: parte coesa e
especialista da tela, organizando átomos e moléculas (formulários, listas,
painéis). Template: organiza os slots da tela, sem marcação de conteúdo
(`tela-de-trabalho`, `entrada`, `conversa`). Page: só renderiza o template com os
slots preenchidos. **Nenhum elemento HTML cru fora de `atoms/` e `ui/`** (lint): o
contêiner é `Caixa` (`como="section"|"ul"|"li"|"form"…`), o ritmo vertical é
`Pilha espaco={1|2|3|4|6|8|"campo"|"formulario"}`, a linha é `Linha`
(`alinhar`, `justificar`, `espaco`, `quebra`), a malha é `Grade colunas="1>2"|"1>3"|…`,
e o texto é `Texto` com um
papel (variantes em `atoms/texto.component.tsx`: `destaque`, `corpo`, `apoio`, `alerta`,
`nota`, `titulo`, `tela`…). Trecho que só agrupa ou quebra
linha é `Caixa`, não `Texto`. Cabeçalho e navegação da aplicação ficam fora do
`<main>` (landmarks de topo).

`password-input` e `theme-toggle` ficam em `ui/` de propósito: guardam estado
visual efêmero (mostrar/ocultar, tema) e `'use client'` é permitido ali
(arquitetura.md 4.7).

`src/presentation/components/ui/` — primitivas estilo shadcn (kebab-case,
sem sufixo `.component`, isentas de teste por convenção —
`docs/testes.md`):

Checkboxes/radios nativos (`src/app/globals.css`): `accent-color:
var(--primary)` global — sem isso, o navegador pinta o azul padrão do SO,
brigando com o verde-cheque do resto do produto. Primeiro uso real em
`editar-cadastro-operacional-form.component.tsx` (#34: "Tem parcelamento",
"Atividade do mês", "Padrão" de cada Contato); a regra é global porque
`accent-color` é herdado por elemento nativo, não por componente — qualquer
`<input type="checkbox">`/`type="radio"` futuro herda o token automaticamente,
sem precisar de classe.

- `button.tsx` — variantes `default`/`destructive`/`outline`/`ghost`,
  tamanhos `default` (36px), `sm` (32px), `icon` (36px); em aparelho de toque
  (`pointer-coarse:`) todos sobem para 44px, o alvo de toque. Exporta
  `buttonVariants` (a função `cva` por trás do componente) para qualquer
  elemento que precise da mesma aparência sem ser um `<button>` de verdade —
  o link "Meu perfil" do `ShellHeader` é o primeiro consumidor
  (`buttonVariants({ variant: "ghost", size: "sm" })` num `<Link>`), evitando
  reimplementar as classes do ghost/sm à mão. Qualquer link estilizado como
  botão reusa `buttonVariants` em vez de duplicar classes.

  **Rótulo de ação oculto abaixo de `lg` (#32; subiu de `sm` para `lg` em
  13/10/2026, quando a sonda de reflow mostrou rolagem horizontal do Admin a 320 e 768 px;
  abaixo de `lg` a identidade e as ações também empilham em duas linhas):** os
  links de ação do `ShellHeader` (hoje "Cadastrar Líder"/"Cadastrar
  Funcionário", "Usuários" e "Meu perfil") escondem o texto do rótulo em telas
  estreitas (`Texto variante="soDesktop"`, `hidden lg:inline`) mantendo só o ícone —
  necessário porque o header ganhou um terceiro link de ação neste ticket, e
  o rótulo completo dos três (mais o toggle de tema e "Sair") não cabe em
  larguras de celular sem rolagem horizontal. `aria-label` no próprio
  `<Link>` preserva o nome acessível igual ao texto visível em telas largas;
  o ícone sozinho nunca carrega o significado sem esse rótulo. Qualquer novo
  link de ação no header segue o mesmo padrão em vez de forçar o texto
  sempre visível.

  **Extensão (#33):** o link "Cadastrar Cliente" (ícone
  `Building2`, visível só pro papel Admin) segue exatamente esse padrão —
  confirma que a regra vale para qualquer novo link, não só os três
  documentados em #32.

  **Identidade do usuário no header (#56):** abaixo de `sm` o nome e o escopo
  (`Papel · Setor: <rótulo>`) quebram linha em vez de truncar, e o avatar da
  inicial (decorativo, `aria-hidden`) some para liberar largura — truncar
  escondia o Setor do usuário no celular. De `sm` pra cima voltam o avatar e o
  `truncate`. O Setor é sempre o rótulo legível (`SETOR_LABEL`, em
  `shared/kernel/setores.ts`), nunca o slug.

  **Extensão (#72):** o link "Feriados" (ícone `CalendarOff`,
  só Admin, rota `/admin/feriados`) segue o mesmo padrão. A tela reutiliza
  `FieldError`, `Input type="date"` com `Label` visível e lista em `card`
  com `divide-y`; remover é botão `ghost` só-ícone com `aria-label` que
  inclui a data.
- `input.tsx` — 36px de altura (44px em aparelho de toque); `aria-invalid` troca borda/anel para
  `destructive` automaticamente. `input`, `select` e `textarea` usam
  `text-base sm:text-sm`, assim como `atoms/file-input.component.tsx`: 16 px no celular (abaixo
  disso o iOS dá zoom ao focar o campo), 14 px de `sm` em diante. Campo de texto
  novo usa o primitivo de `ui/`, nunca um `<textarea>`/`<select>` cru.

  **Campo de arquivo sempre com `Label` visível (#33):** o
  cadastro de Cliente introduziu os primeiros `<Input type="file">` do
  produto (contrato social e cada alteração contratual). O primeiro rascunho
  usava `aria-label` sozinho no arquivo de cada alteração contratual, sem
  `Label` visível — inconsistente com todo outro campo do formulário, que
  sempre tem rótulo visível emparelhado por `htmlFor`/`id`. Corrigido na
  revisão impeccable: todo campo de arquivo usa `Label htmlFor` + `Input id`
  como qualquer outro campo, sem depender só de `aria-label`. **Superado
  pelo `atoms/file-input.component.tsx` abaixo** —
  o contrato de `Label htmlFor`/`id` continua valendo, só o controle em si
  deixou de ser um `<input type="file">` nu.
- `atoms/file-input.component.tsx` (#33): `<input type="file">` nativo não aceita ser
  estilizado diretamente ("Choose File / No file chosen" do navegador era o
  único controle do produto fora do sistema de design). Substituído por uma **área de soltar**:
  `<label>` quase quadrado (`min-h-28`, borda tracejada, raio, cores do tema) envolvendo o input
  real como `sr-only` — o clique aciona o seletor do SO, **arrastar e soltar** entrega o arquivo
  (destaque em `primary` enquanto arrasta, via `data-arrastando`, sem estado) e o foco por teclado
  no input escondido acende o anel via `has-[:focus-visible]`. Estado vazio: ícone `Upload` cinza,
  "Arraste o arquivo aqui" e "ou clique para selecionar"; com arquivo: `FileText` verde
  (`text-primary`), o nome e "Clique ou arraste para trocar". O tipo do arquivo solto não é
  filtrado no átomo: o schema do formulário mostra o erro. No cadastro de Cliente o Contrato
  social ocupa 1 coluna e o arquivo da alteração, 2.
  Qualquer novo campo de arquivo do produto reusa este componente em vez de
  um `<Input type="file">` cru.

  **Seção "Documentos" (#33):** contrato social e alterações
  contratuais ganharam um agrupamento visual próprio — `border-t` +
  `pt-6` + heading `text-sm font-semibold uppercase text-muted-foreground`
  ("DOCUMENTOS"), separando os campos de identificação do Cliente (CNPJ,
  Empresa, Regime) dos campos de documento. Mais espaço acima do heading que
  abaixo, mesma cadência do resto do produto. Qualquer formulário futuro com
  dois grupos de campos claramente distintos (identificação vs. anexos, por
  exemplo) reusa esse padrão de divisor em vez de um `<hr>` genérico ou um
  segundo cartão.
- `password-input.tsx` (#56) — `Input` com botão de exibir/ocultar
  (`Eye`/`EyeOff`, alvo 44px) dentro do campo; usado no login e na troca de
  senha. O `aria-label` do botão ("Mostrar/Ocultar caracteres") evita a
  palavra "senha" de propósito, para não colidir com `getByLabel("Senha")`
  dos e2e.
- `select.tsx` — mesmo tratamento visual do `input.tsx` (36px, 44px no toque, mesmas
  bordas/foco, e o mesmo `aria-invalid` para borda/anel `destructive`).
  Introduzido no feed de auditoria para eliminar classes Tailwind duplicadas
  entre os dois `<select>` do filtro (Setor, Resultado); o cadastro de
  Líder/Funcionário (#30, campos Papel/Setor) foi o primeiro consumidor a
  marcar `aria-invalid` num `<select>`, o que expôs a falta do tratamento de
  erro no componente — corrigido no próprio `select.tsx` em vez de um
  ajuste local, para qualquer select de formulário futuro herdar o mesmo
  contrato de erro do `input.tsx`. Qualquer novo select do produto reusa
  este componente em vez de repetir as classes inline.

  **Campo travado quando só há 1 opção válida (#32):** no
  cadastro de Líder/Funcionário, quando quem está logado é Líder de setor,
  o caso de uso só aceita `papel = "funcionario"` no próprio Setor — ou
  seja, os `<select>` de Papel e Setor têm exatamente 1 opção possível.
  Nesse caso o campo vem `disabled` com essa opção já selecionada
  (`defaultValue`), sem o placeholder "Selecione": não existe escolha real
  a fazer, só confirmação visual do que vai ser cadastrado. Só aparece a
  lista completa + placeholder quando há mais de 1 opção (Admin). Qualquer
  campo de formulário futuro com esse mesmo formato (opções decididas por
  RBAC, às vezes reduzidas a 1) segue o mesmo padrão em vez de forçar uma
  seleção sem escolha real.

  **Sem opacidade de desabilitado, só para confirmação de escolha (revisão impeccable, 28/09/2026;
  escopo restrito em 21/10/2026):** o
  `disabled:opacity-50` padrão de `select.tsx` existe pra sinalizar "campo
  indisponível" — o oposto do que esse padrão precisa comunicar ("aqui está
  o que vai ser cadastrado", uma confirmação, não uma ausência). Por isso
  esses dois `<select>` passam `className="disabled:opacity-100"` pra
  sobrescrever a opacidade herdada e manter o texto na cor plena — o cursor
  `not-allowed` (herdado, mantido) já basta pra sinalizar "sem interação
  aqui". Qualquer campo futuro que reuse o padrão de campo travado acima
  reusa também esse override. **Escopo (21/10/2026):** isto vale só para o campo que *confirma a
  única escolha possível* (Papel/Setor do #32). O campo que *o usuário não pode alterar* (Empresa,
  CNPJ, Regime, Responsável sem permissão, DAS já enviado, Data de envio, qualquer campo da
  visualização somente leitura) **mantém o `disabled:opacity-50` e o cursor `not-allowed`
  padrão**: o esmaecimento é o sinal de "não editável". A decisão de 28/09 de manter a cor plena
  também nesses campos foi revertida a pedido do usuário.
- `label.tsx`, `atoms/field-error.component.tsx` — erro de campo sempre ícone (`AlertCircle`)
  + texto + cor, nunca só cor (contrato "Talão de Cheque": estado por
  padrão/ícone além de cor).
- `theme-toggle.tsx` — único ponto de troca de tema, hoje vive no
  `ShellHeader`; o login não tem toggle (decisão desta rodada — ver relatório
  do pipeline).

Ícones: `lucide-react`, traço único consistente — nunca emoji/glyph Unicode
como ícone (ex.: link "Voltar" usa `ArrowLeft`, não o caractere "←";
reusado no cadastro de Líder/Funcionário).

### Indicadores de estado (sucesso/falha)

O mesmo contrato do `atoms/field-error.component.tsx` (ícone + texto + cor, nunca só cor) se
estende a qualquer indicador de resultado, não só erro de formulário nem só
listas. No feed de auditoria, a coluna "Resultado" combina
`CheckCircle2`/`XCircle` + o texto (`sucesso`/`falha`) +
`text-primary`/`text-destructive`. O cadastro de Líder/Funcionário (#30)
reusa o mesmo par `CheckCircle2` + `text-primary` na mensagem de confirmação
de conta criada, fora de uma lista — confirma que o contrato é de indicador
de resultado em geral, não específico de tabela. `success` (dourado) fica
reservado ao selo "em dia" do Simples Nacional — não se usa aqui para não
sobrepor dois significados no mesmo token.

**`FieldError` com texto longo:** o ícone alinha na primeira linha
(`items-start` + `mt-[3px]`, 14 px de ícone sobre 20 px de linha), então o
componente serve para uma linha ou para várias sem mudar de aparência.

**Aviso (não é erro de validação, mas usa o mesmo componente):** o feed de
auditoria já usava `atoms/field-error.component.tsx` pra avisar período incompleto mesmo sem
ser um erro de schema — o cadastro de Cliente (#33) confirma que
isso é um padrão, não uma exceção. Quando a interface precisa dizer "isso não
está errado, mas você precisa fazer algo a respeito" (CNPJ com formato válido
mas não encontrado na consulta pública; Regime que a consulta não conseguiu
confirmar automaticamente), o produto **não tem uma variante visual
"aviso"** separada — reusa `FieldError` (ícone + texto +
`text-destructive`) com uma mensagem que orienta a ação manual, em vez de
inventar uma cor/ícone intermediário. O aviso é state do Container (não do
schema Zod: `avisoCnpj`/`avisoRegime` em `criar-cliente.container.tsx`), e
some assim que o usuário edita o campo correspondente a mão — nunca fica
preso na tela depois que a pessoa já agiu sobre ele.

### Ações pós-sucesso (confirmação de cadastro)

**"Cadastrar outro" / "Finalizar" (#32):** a tela de
confirmação do cadastro de Líder/Funcionário (senha provisória exibida)
ganhou duas ações lado a lado — `Button` primário "Cadastrar outro"
(ícone `UserPlus`, limpa Nome/E-mail e devolve o formulário pronto pra um
novo cadastro, mantendo Papel/Setor travados quando aplicável) e um
`<Link>` estilizado com `buttonVariants({ variant: "outline" })` "Finalizar"
(ícone `Check`) que leva pra `/`. `/` é provisório: ainda não existe uma
tela própria do Setor pra voltar (a tela de troca de senha agora vive em `/perfil`, #56, linkada no
`ShellHeader` como "Meu perfil") — trocar o destino quando essa tela
existir, sem mudar o padrão dos dois botões em si. Vale pra qualquer tela
futura de cadastro em lote (ex.: Cadastro de Cliente, #33): oferecer
continuar sem sair, e um jeito explícito de encerrar.

**Confirmado em #33:** o cadastro de Cliente reusa o mesmo par de botões
sem alteração — `Button` primário "Cadastrar outro" (ícone `UserPlus`,
limpa o formulário e reseta a lista de alterações contratuais) e `<Link>`
"Finalizar" pra `/`, mesma justificativa provisória do destino.

**Largura compacta (#36):** depois que o
container da página virou `w-[80%]`/`w-[90%]` (#36, seção Layout), a
confirmação de cadastro (senha provisória, ou só o aviso de sucesso) parou
de fazer sentido esticada pra largura inteira — vira uma caixa pequena,
`max-w-md mx-auto` (cadastro de usuário, tem mais conteúdo: senha provisória
em bloco mono) ou `max-w-sm mx-auto` (cadastro de Cliente, só uma linha de
texto), cada uma só um pouco mais larga que os dois botões lado a lado.

### Formulários de criar: campos lado a lado (#36)

Com o container largo, empilhar cada
campo numa linha própria (`flex flex-col gap-5`) deixa o formulário raso e
alongado sem aproveitar a largura. Campos de identificação simples (texto
curto, `Select` de poucas opções) agora ficam num `grid` — 2 ou 3 colunas
conforme o número de campos do grupo, nunca mais que isso (texto longo tipo
Observações, upload de arquivo e listas repetíveis continuam em coluna
única, não cabem bem num grid raso):

- `CriarUsuarioForm`: Nome/E-mail/Papel/Setor em `grid-cols-1 sm:grid-cols-2`.
- `CriarClienteForm`: malha `1>2>4` (1 coluna no celular, 2 em `sm`, 4 em `lg`); CNPJ, Empresa (2
  colunas), Regime; E-mail (2 colunas); na seção "Documentos", Contrato social em 1 coluna e cada
  alteração em uma fileira (nº, data, arquivo em 2). **Revisado em 21/10/2026**: antes eram 2
  colunas e o arquivo em linha inteira; a área de soltar quadrada deixou de pedir a linha toda.
- `EditarCadastroOperacionalForm`: também em 4 colunas (ver "Cadastro de Cliente e documentos
  contratuais").

Formulário isolado de coluna única (login, troca de senha) fica de fora
dessa regra — container estreito (`max-w-sm`/`max-w-md`, não entra na
regra de largura de formulário), poucos campos, grid não ajudaria.

### Lista de itens repetíveis (campo dinâmico)

**Alterações contratuais (#33):** primeiro uso de
`useFieldArray` (react-hook-form) no produto — uma lista de itens do
formulário que o próprio usuário adiciona/remove (aqui: data + arquivo por
alteração contratual). Padrão: cabeçalho da seção com `Label` da seção +
`Button` `outline`/`sm` "Adicionar" (ícone `Plus`) alinhados nas pontas
(`justify-between`); cada item vira um bloco próprio com borda
(`rounded-md border border-border p-3`), um cabeçalho interno "Item N" +
botão `ghost`/`sm` "Remover item N" (ícone `Trash2`, `aria-label` explícito
porque o botão só tem ícone) e os campos do item abaixo, no mesmo espaçamento
vertical dos campos do formulário principal. O bloco com borda existe só
para diferenciar visualmente item de campo simples — não é um cartão
elevado (`bg-card`), fica no mesmo plano do formulário. Qualquer lista
dinâmica futura (Data + arquivo, ou qualquer par de campos repetível) reusa
este padrão em vez de inventar um novo.

**Confirmado em #34:** o cadastro operacional (Contatos) reusa o mesmo
padrão sem alteração — bloco com borda por contato, "Remover contato N"
com `aria-label` numerado, botão "Adicionar contato" nas mesmas
variante/tamanho. Segundo consumidor confirma que o padrão vale para
qualquer lista dinâmica de campos, não só o par data+arquivo do #33.

### Campo obrigatório e máscara de entrada

**`RequiredMark` (#33):** asterisco
`text-destructive` depois do texto do `Label`, com `aria-hidden="true"` —
fica fora do nome acessível do campo de propósito (screen readers já
anunciam "obrigatório" via `aria-required="true"` no próprio input, não
precisa duplicar em texto). Um parágrafo no topo do formulário
(`text-xs text-muted-foreground`) explica a convenção uma vez:
*"Campos com \* são obrigatórios."*. Qualquer campo obrigatório novo usa
`<RequiredMark />` + `aria-required="true"` no input, em vez de confiar só
na mensagem de erro do submit pra sinalizar isso.

**Confirmado em #34:** os campos Nome e Telefone de cada Contato (únicos
campos obrigatórios do cadastro operacional — os demais são `enum`/`select`
com valor sempre presente ou opcionais) usam `<RequiredMark />` +
`aria-required="true"`, mesmo padrão do #33.

**Máscara de exibição (#33):** quando um campo tem um formato
canônico bem definido (CNPJ: `00.000.000/0000-00`), a formatação acontece
progressivamente enquanto o usuário digita, via `Controller` controlado
(não `register` — precisa interceptar `onChange` pra reformatar o valor).
A máscara é puramente visual (`src/presentation/lib/cnpj-mask.ts`); a
validação de formato de verdade (dígito verificador) é uma função separada
(`cnpj-validation.ts`, mesmo `presentation/lib/`) rodada via
`.refine()` no schema Zod — `view-models` não podem importar `domain`
(`arquitetura.md`, regra de dependência), então a checagem client-side
duplica de propósito o algoritmo do domínio só pra dar feedback cedo; a
validação que vale de verdade continua do lado do servidor.

**Confirmado em #34 (Telefone):** segundo consumidor do padrão de máscara —
`telefone-mask.ts` formata progressivamente `(00) 0000-0000` (fixo, 10
dígitos) ou `(00) 00000-0000` (celular, 11 dígitos), mesma técnica
(`Controller` controlado, não `register`). Diferença do CNPJ: Telefone não
tem VO próprio com dígito verificador no domínio (`Contato.criar` só exige
presença) — a máscara aqui é só visual, sem contraparte de validação de
formato/checksum no domínio ou no schema.

### Ações do formulário (Salvar/Limpar/Cancelar)

**#34:** formulário de edição (não de cadastro
em lote, ver "Ações pós-sucesso" acima) ganha três ações lado a lado, só em
modo edição (nenhuma aparece em modo somente-leitura, já que não há o que
salvar/desfazer/cancelar): `Button` primário "Salvar"; `Button`
`outline` "Limpar", que reverte o formulário pro que veio do servidor
(`reset()` do react-hook-form com os mesmos valores do `defaultValues`) —
**não esvazia campos**, porque campos `enum` obrigatórios (ex.: Forma de
envio) não têm opção em branco no `Select`, então "limpar de verdade"
quebraria a validação; e "Cancelar" `destructive` (vermelho — revisado no
#35, era `ghost` na entrega original do #34 e o usuário pediu destaque de
cor pra uma ação que descarta a edição). Qualquer tela de edição futura
(distinta de cadastro em lote) reusa este trio em vez do par "Cadastrar
outro"/"Finalizar".

**#35, reuso inline:** o mesmo form passou a abrir embutido na seção
"Buscar cliente" do dashboard (`/`), não só na página dedicada
`/clientes/[id]`. Como `/` já é o próprio destino do "Cancelar", um
`<Link href="/">` ali dentro não navega pra lugar nenhum — o form ganhou
uma prop opcional `onCancelar`: quando informada (uso inline), "Cancelar"
vira `Button` que fecha o painel e volta pro campo de busca; sem ela (uso
em `/clientes/[id]`), continua `<Link href="/">`.

### Autopreenchimento a partir de API pública

**CNPJ → Empresa/Regime via BrasilAPI (#33):** ao perder o foco de um campo que serve de chave pra uma consulta
externa, autopreencher os campos derivados sem nunca sobrescrever o que o
usuário já digitou à mão (checagem `!getValues(campo)` antes de cada
`setValue`). Três desfechos possíveis, cada um com tratamento explícito:
sucesso silencioso (campo some preenchido, sem aviso — não precisa
comemorar um autopreenchimento que deu certo); "não encontrado" (aviso,
ver Indicadores de estado → Aviso); "encontrado mas com um dado que a API
não confirma com certeza" (mesmo tratamento de aviso, escopado só ao campo
sem confirmação — aqui, Regime: a API distingue Simples Nacional/MEI com
segurança, mas não Lucro Presumido de Lucro Real, que não é dado público
estruturado). Nunca deixar a consulta travar o preenchimento manual:
`AbortSignal.timeout` curto na chamada, e nenhum estado de "carregando"
visível — ver a nota de corrida de `useFieldArray` abaixo antes de
adicionar um indicador de loading a um fluxo parecido.

**Corrida com `useFieldArray.append()` (#33) — não repetir:** a
primeira versão deste autopreenchimento rastreava um estado `pendente` pra
mostrar "Buscando…". Como a resposta chega enquanto o usuário ainda pode
estar preenchendo o resto do formulário, o re-render provocado por esse
estado colidiu com `useFieldArray.append()` de uma linha dinâmica sendo
adicionada quase ao mesmo tempo — reproduzido de forma determinística em
E2E (o clique registrava, a linha nunca aparecia). Removido o indicador de
loading (a API responde em ~100ms na prática, o ganho de UX não pagava o
risco); os `setState` que sobraram (avisos) entram num `setTimeout(0)` pra
nunca cair no mesmo lote de render de uma ação síncrona concorrente.
Qualquer nova integração assíncrona que atualiza estado dentro de um
formulário com `useFieldArray` segue essa mesma cautela — testar em E2E de
verdade, não só unitário com a chamada externa mockada, antes de considerar
pronto.

### Busca com sugestões (combobox)

**"Buscar cliente" do dashboard (#35):** primeiro typeahead do produto —
padrão pra qualquer busca-com-sugestões futura. `Input` ganha
`role="combobox"`, `aria-expanded`, `aria-controls` apontando pro
`id` da `<ul role="listbox">`, e `aria-autocomplete="list"`; cada
sugestão é um `<li role="option">` (não um `<button>` dentro do
`<li>` — ARIA não permite elemento interativo aninhado num `option`).
Teclado: `ArrowUp`/`ArrowDown` movem um destaque visual (`bg-accent`
+ `aria-selected`) calculado no render a partir do índice guardado em
`useState` — nunca resetado dentro de um `useEffect` (React desaconselha
`setState` síncrono em efeito pelo cascading render; o índice só é válido
se ainda cabe na lista atual do resultado, verificado direto no render);
`Enter` seleciona a sugestão destacada, `Escape` limpa o campo.
Contagem de resultados e estado de carregamento vão num
`role="status" aria-live="polite"` `sr-only` (nunca só o texto visível,
que só ajuda quem enxerga a tela). Ao selecionar um resultado, o foco move
pro título do painel que abre (`ref` + `tabIndex={-1}` + `.focus()`
num `useEffect`) — sem isso, navegação por teclado/leitor de tela perde o
contexto da troca de tela.

### Resumo do setor (anéis de status, #36)

**`ResumoSetorSn` / `ResumoSetorSnLista` (/simples-nacional):**
9 cards fixos (invariante do mapper, ordem garantida por teste) divididos em
dois grupos — "Documentos e DAS" (5) e "Parcelamento" (4) — cada card é um
`Link` inteiro (não botão + link separados) pra
`/clientes/resumo/<bucket>`, que abre a lista filtrada
daquele status como tela própria (não modal, não accordion inline — mesma
razão de qualquer outra navegação do produto: estado via URL, não só client
state). Cada card é um selo circular SVG (anel de progresso, raio 26,
`stroke-linecap: round`, girado -90° pra começar no topo
como um relógio) com a contagem em número grande (`tabular-nums`)
no centro — a cor do traço reusa os tokens semânticos já existentes
(`stroke-primary`/`stroke-success`/`stroke-destructive`/`stroke-muted-foreground`,
mapeados 1:1 com as cores do protótipo aprovado na spec #24), sem introduzir
nenhum token novo. É o primeiro uso visual real do token `success`
(dourado) desde que foi definido — deixa de ser "token sem uso" (ver "O que
ainda não existe" abaixo).

**Título do card e contagem total via sr-only:** a proporção visual do anel
(fração preenchida do círculo) não tem equivalente textual pra quem usa
leitor de tela — corrigido na revisão impeccable (01/10/2026): cada card
carrega um `<span className="sr-only">` depois do título com
"— N de M clientes", garantindo que o nome acessível do link expresse a
mesma proporção que o anel mostra visualmente, não só a contagem isolada.
Qualquer novo indicador em anel/gráfico futuro reusa esse padrão (contexto
textual completo em sr-only, nunca só o número visível).

**`<h1>` da página, não `<h2>` (01/10/2026):** desde que
"Resumo do setor" ganhou página própria (`/simples-nacional`, decisão
registrada na seção Layout acima), seu título é o heading de nível 1 do
conteúdo da página — corrigido na revisão impeccable (era `<h2>` de
quando ainda vivia embutido em `/` ao lado de outras seções).
`ShellHeader` não tem heading próprio (mostra nome/papel de
sessão, não título de página), então cada página de conteúdo é responsável
pelo próprio `<h1>` — `ResumoSetorSnListaPage` (drill-down de
bucket) já seguia essa regra desde a implementação original.

**Lista de drill-down (`ResumoSetorSnLista`):** linhas simples
(`divide-y` + borda, sem o tratamento de card elevado) — empresa em
destaque, CNPJ mascarado abaixo em texto secundário, "Ver cadastro →" como
affordance textual de navegação (não ícone sozinho). Cada linha leva pra
`/clientes/[id]` (#34, tela de edição/consulta já existente) com
`?voltarPara=` apontando de volta pra própria lista — "Voltar" na
tela de edição retorna pro bucket, não pro resumo geral.

**Comparativos (`ComparativosSn`, #37):** seção abaixo do resumo do setor,
grid `md:grid-cols-2 lg:grid-cols-3` (3 gráficos) — o Líder do SN ganha um 4º
(#65, abaixo) e a grade vira `md:grid-cols-2` (2×2, duas linhas de dois: em
4 colunas os cartões ficavam apertados). O título da seção é `<h2>`
`text-lg font-semibold` (mesmo papel de "Buscar cliente"); o `<h1>` da página
("Resumo do setor") segue o padrão de título de página do app
(`text-xl font-bold tracking-tight text-primary`) — h1 e h2 nunca com o mesmo
tamanho; cada gráfico é um cartão
`rounded-xl border bg-card` (mesma superfície dos cards do resumo, sem
guilhochê) com `role="group"` + título. DAS e parcelamento são donuts SVG
(sem biblioteca de gráfico, anel de fundo `stroke-border`); Atividade do mês
é lista de barras proporcionais ao total de clientes e ocupa a largura toda
no tablet (`md:col-span-2`). Só tokens existentes: `primary` (enviado),
`destructive` (pendente), `success` (pronto), `muted-foreground` (sem
movimento/interno). A cor nunca é o único
canal: toda fatia tem legenda com rótulo e número.

**4º comparativo — "Envio de DAS por Responsável" (#65, só Líder):** barras
proporcionais ao total de clientes, mesmo layout de "Atividade do mês"
(`Barras` recebe a nota como prop; sem `col-span` quando são 4 cartões).
Conta Clientes com DAS **Enviado** por Responsável; "Sem responsável" usa o
tom neutro (`bg-muted-foreground`, mesmo de "Sem movimento"/"Interno"), cada
Funcionário o tom primário. Nome longo trunca com reticências + `title` e o
número fica `shrink-0`. Sem nenhum cliente atribuído: texto "Nenhum cliente
atribuído ainda." no lugar da lista. Funcionário (e Admin) continuam vendo só
os 3 gráficos originais.

**Estado vazio do resumo (#65):** Funcionário sem clientes atribuídos vê o
dashboard normal (cards zerados) mais um aviso neutro,
`text-sm text-muted-foreground` ("Nenhum cliente no resumo ainda. Os clientes
atribuídos a você aparecem aqui.") — a RLS esconde os clientes dos outros, não
há tela de "sem acesso".

**Campos só do sistema no cadastro operacional (#108):** o status DAS "Enviado" e a
"Data de envio" nascem da entrega automática, não da digitação. "Enviado" não é
opção do `Select` do DAS; só aparece enquanto o DAS **salvo** já está enviado, para
exibir o valor atual. A "Data de envio" é o `Input type="date"` `readOnly`, `aria-readonly="true"`
e `disabled`; o `Select` do DAS fica `disabled` quando o status salvo já é "Enviado". Os dois
aparecem com o esmaecimento e o cursor `not-allowed` de qualquer campo desativado (como Empresa,
CNPJ e Regime), para o usuário entender que não se alteram. Salvar preserva os valores.

**Campo Responsável no cadastro operacional (#65):** fica no cabeçalho de
identidade do formulário, não no fim — a linha Empresa · CNPJ · Regime ·
Responsável é uma grade `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1.2fr_1.2fr_2fr]`
(Empresa e Responsável mais largos pra nomes longos; Regime e CNPJ sem cortar o texto). Os 3 primeiros são `Input`
`disabled readOnly`; o Responsável é o único editável dessa linha, por isso o
bloco deixou de ser um `fieldset disabled` (cada campo carrega o próprio
`disabled`). Líder do SN vê um `Select` ("Sem responsável" + Funcionários do
SN); quem só visualiza (Funcionário, Admin, outros Setores) vê um `Input`
desabilitado com o nome — "Sem responsável" sem atribuição, "Responsável de
outro setor" quando a RLS esconde o perfil. A lista de Funcionários é
carregada **só quando o Select recebe foco** (React Query, `enabled` ligado
no `onFocus`); antes disso só o Responsável atual está nas opções. Estados:
"Carregando…" como `<option disabled>`; falha de carga vira
`FieldError` ("Não foi possível carregar a lista de Funcionários.") com botão
ghost "Tentar de novo" ao lado (nunca só uma opção desabilitada, que não tem
saída). Salvar grava o cadastro e depois a atribuição; se só a segunda
falhar, a mensagem diz que os dados foram salvos
("Os dados foram salvos, mas não foi possível atribuir o Responsável. …") e
reenviar repete só a atribuição.

**Rótulos de Setor/Regime:** slugs do banco nunca aparecem como texto de UI;
usar `SETOR_LABEL` (`shared/kernel/setores.ts`) e `REGIME_LABEL`.
`ThemeToggle` mostra o ícone do tema de destino (sol no dark, lua no light).

### Lista de usuários e desativação inline (#58)

`/admin/usuarios` (só Admin) lista usuários ativos num `<ul>` de linhas sobre
`card` com `divide-border`. A ação "Desativar" é um `Button` `outline`/`sm`; ao
clicar, troca no próprio lugar por "Confirmar" (`destructive`) + "Cancelar"
(`ghost`) — confirmação inline, sem modal. Erro aparece abaixo com
`AlertTriangle` + `text-destructive` (`role="alert"`). A linha do Admin não tem
ação. `ShellHeader` ganhou o link "Usuários" (ícone `Users`, rótulo oculto
abaixo de `sm`, mesmo padrão dos demais links de ação).

### Troca de papel inline (#57)

Na mesma linha, ao lado de "Desativar", um `Button` `outline`/`sm`: "Promover"
(Funcionário → Líder de setor) ou "Rebaixar" (Líder → Funcionário), com
`aria-label` completo ("Promover Fulana a Líder de setor"). Sem confirmação (a
troca é reversível e auditada). Se o Setor já tem Líder ativo, o erro explícito
aparece abaixo do botão (`AlertTriangle` + `text-destructive`, `role="alert"`,
`max-w-64`) pedindo para rebaixar o atual antes — nunca há troca automática. Os
dois botões ficam num `flex gap-2`; a linha do Admin segue sem ação. Nenhum token
novo.

### Conversa do Atendimento (#49)

Desenho de chat (WhatsApp/Messenger), decisão do usuário (2026-10-08):

- **Balões** (`MensagemBalao`): cliente à esquerda, `bg-card` com borda e a
  ponta no canto superior esquerdo; Funcionário à direita em `bg-primary`;
  URA à direita em `bg-accent`. O balão do cliente mostra o nome do Contato
  e, abaixo, `CNPJ 00.000.000/0000-00` ou "CNPJ não definido"; o do
  atendente mostra nome e Setor. A hora fica dentro do balão, no canto
  inferior direito, em `text-xs`.
- **Lista de mensagens** (`ListaDeMensagens`): um rolador `role="log"`
  (`aria-label="Conversa"`) em `flex-col-reverse` com o `<ol>` cronológico
  dentro — o navegador mantém a rolagem no fim (nas últimas conversas) sem
  JavaScript, o DOM segue a ordem de leitura e o leitor de tela anuncia a
  mensagem nova. Rolar para cima para ler o histórico não é puxado de volta
  quando chega mensagem nova. Balões sem sombra; a hora do balão do
  Funcionário usa `opacity-90` (contraste ≥ 4,5:1 nos dois temas).
- **Histórico anterior**: a conversa carrega só as mensagens mais recentes;
  "Ver mensagens anteriores" (`BotaoDeLink`, 44 px, sublinhado) fica no topo da lista,
  vira "Carregando…" enquanto busca e some quando não há mais. A falha aparece como
  `AvisoDeStatus` de erro logo abaixo do botão, sem derrubar o que já está na tela. O
  histórico aberto continua na tela quando a conversa se atualiza; uma resposta atrasada
  que não encaixa na janela atual é descartada e o botão segue disponível.
- **Envio não confirmado**: a mensagem do Funcionário que o provedor ainda não
  aceitou (ou recusou) mostra "Envio não confirmado ·" em `font-semibold` antes da hora,
  no próprio balão, sem trocar a cor dele: o texto e o anexo continuam visíveis e a
  mensagem não conta como resposta para a inatividade. O estado vem do texto, não da cor.
- **Reação do escritório** (#84): o balão do cliente tem, fora dele à direita
  (`left-full`, largura reservada no `max-w`), o botão `ghost` redondo de 28 px
  "Reagir à mensagem de <nome>" (mesmo `SeletorDeEmoji`, `compacto`). O glifo
  fica em 28 px, mas a área de toque é de 44 px (`before:-inset-2`): o alvo
  cresce sem engordar o balão. O painel
  "Emojis da reação" é `fixed` posicionado pelo botão (não é cortado pelo rolador)
  e fecha com Esc, clique fora ou rolagem. A reação aparece como pílula de emoji
  abaixo do texto em `text-base` (`role="img"`, "Reação do escritório: 👍");
  escolher o mesmo emoji remove. Se a reação falhar, o erro (`role="alert"`)
  aparece **abaixo** do rolador, não dentro dele: em `flex-col-reverse` o que
  vem depois do `<ol>` ficaria no topo, fora de vista.
- **Campo de resposta** (`CompositorDeMensagem`): `Textarea` arredondado +
  botão redondo de enviar (placeholder "Escreva aqui"; o nome acessível vem
  do rótulo oculto "Mensagem ao cliente"). Enter envia, Shift+Enter quebra a linha (Enter de composição, IME ou
  teclado de celular, não envia; o Safari entrega esse Enter com `isComposing` falso e
  `keyCode` 229, por isso os dois são checados); o campo só esvazia quando o envio dá certo (se falhar, o texto fica). À esquerda do
  campo, o botão redondo `ghost` "Inserir emoji" (`SeletorDeEmoji`, #78) abre um
  painel acima dele. Com recentes (até 8, por navegador) o painel mostra só a
  linha "Recentes" e o botão "Ver todos os emojis"; sem recentes, ou depois do
  "ver todos", as categorias Rostos, Gestos, Objetos e Símbolos. Cada emoji é um
  botão de 44 px com nome acessível; a linha de recentes quebra em duas
  quando não cabe. Escolher insere na posição do cursor e devolve o foco ao campo; Esc
  (de qualquer foco) e clique fora fecham. O limite de 4096 conta caracteres como o
  WhatsApp (emoji vale 1), por isso o campo não usa `maxLength`.
- **Anexos** (#79): o clipe (`BotaoDeAnexo`, 44 px) fica à esquerda do emoji; o arquivo
  escolhido vira `PreviaDeAnexo` acima do campo (miniatura ou ícone, nome, tamanho,
  remover; "Enviando…" com `role="status"` durante o envio) e o texto passa a ser a
  legenda. No balão, imagem é miniatura de 160 px (caixa fixa, sem salto de layout)
  que abre num diálogo nativo (`popover`): faixa própria no topo com "Baixar" e
  "Fechar imagem" (44 px cada, fora da foto, que fica com teto `90dvh − 5rem`), e a
  imagem ampliada com `alt=""` porque o diálogo já se chama "Imagem ampliada: nome".
  O véu é o token `overlay` (`backdrop:bg-overlay`). Arquivo é uma linha com ícone, nome
  (trunca, `title` com o inteiro), tamanho e as ações "Visualizar" e "Baixar":
  PDF e TXT abrem numa aba; Word e Excel abrem num painel `popover` com a prévia
  lida no navegador (Word num iframe `sandbox=""`; planilha como tabela com o nome
  em `caption` e no máximo 500 linhas, "Mostrando as primeiras N linhas"). O Word
  fica em fundo branco (`#fff`) nos dois temas, de propósito: é papel, a única
  superfície fora dos tokens. Como o iframe é `sandbox=""` e não herda o CSS da
  página, o documento leva um estilo próprio (`system-ui` 15px, texto `#1c1917`,
  bordas de tabela `#d6d3d1`): exceção consciente à regra de Roboto única, porque
  o conteúdo é do cliente e não faz parte da interface. Carregando é `role="status"`; falha diz para fechar e
  usar Baixar; planilha ou documento sem conteúdo têm aviso próprio; a leitura tem
  teto de 30 s e um clique repetido não baixa duas vezes. Arquivo de áudio não
  tem "Baixar": só o player. Arrastar um arquivo sobre a conversa acende a moldura
  de guilhochê (`SobreposicaoDeSoltar`, "Solte para anexar", entrada de 180 ms só
  com `motion-safe:`) e sobre o campo, um anel `primary`; é só enfeite de mouse, o
  caminho por teclado é o clipe. Texto e link arrastados não acendem nada.
  No celular (abaixo de `sm`) o campo ocupa a linha toda e clipe, emoji e enviar
  ficam numa linha própria abaixo, com enviar à direita; de `sm` em diante, tudo
  numa linha só.
- **Áudio** (#80): o microfone (`BotaoDeMicrofone`, 44 px) fica entre o emoji e o
  enviar; sem suporte (navegador sem gravação, página sem HTTPS) fica `disabled`,
  com o motivo escrito abaixo do campo e ligado ao botão por `aria-describedby`.
  Gravando, a `BarraDeGravacao` ocupa o lugar do campo: lixeira (cancelar) à
  esquerda, ponto `destructive` que pulsa só com `motion-safe:` e o cronômetro
  `mm:ss` em numerais tabulares, e enviar à direita, que recebe o foco (Enter envia,
  Esc cancela; a dica de teclado some em telas sem hover). A nota abaixo é
  `role="status"`, montada uma vez, para o início ser anunciado sem narrar o
  cronômetro. No limite (5 min ou 10 MB) o ponto fica cinza e a nota explica; ao
  sair da barra o foco volta ao microfone. No balão, o áudio é o player nativo
  (`PlayerDeAudio`, 44 px, largura mínima de 12 rem) com play, progresso e duração.
- **Painel de ações** (`PainelDeAcoes`, à direita, 19 rem; 22 rem em `2xl`):
  compacto. Serviços "Contrato social", "Guia de imposto", "Guia de
  parcelamento" e "CND" em botões `sm` numa grade de duas colunas (o contrato,
  quando o Cliente não o tem, fica `disabled` com a frase "Contrato social não
  cadastrado." visível, não só em `title`; todos ficam `disabled` enquanto um
  envio está em andamento); alteração contratual em **seletor** de largura
  total com o botão abaixo (para o rótulo "Alteração nº N - data" caber nos
  19 rem); Setor de destino em seletor + botão na mesma linha; resumo da
  transferência em `Textarea` baixo. Em janela baixa o painel
  rola por dentro. Transferido, o painel troca tudo por um aviso e a tela
  sai da conversa.
- **Aviso de inatividade** (#73, `CabecalhoDaConversa`): quando a URA avisou
  que vai encerrar o Atendimento por falta de resposta do Funcionário, o
  cabeçalho mostra um `FieldError` (ícone + texto, `role="alert"`) logo abaixo
  do contexto. Só o dono do Atendimento o vê, e some assim que ele escreve ou o
  Atendimento encerra. Não há alerta no dock. Contraste conferido: 8,42:1 no
  claro e 6,75:1 no escuro; em 360 px o texto quebra em 3 linhas e a página
  rola, em 1024×600 o chat mantém ~230 px.
- **Encerrar atendimento** (no fim do `PainelDeAcoes`, separado por `border-t`):
  botão `outline`; o primeiro clique só abre a confirmação (`role="alertdialog"`
  com o aviso de que o cliente será avisado) com "Confirmar encerramento"
  em `destructive` e "Cancelar" (que recebe o foco ao abrir, pois o botão que
  pediu a confirmação some). A pergunta descreve o diálogo (`aria-describedby`)
  e, enquanto encerra, "Cancelar" fica `aria-disabled` (não `disabled`), sem
  perder o foco. Encerrar não tem volta.
- **Fila do Setor** (`FilaDoSetor` + `ItemDaFila`, #70): na tela `/fila`
  (`max-w-3xl`, h1 "Fila de atendimento do <nome>, setor <Setor>", seletor de
  Setor só para o Admin) e como barra lateral esquerda da conversa (18 rem; 20
  rem em `2xl`) **só de `xl` para cima**, para o chat não espremer em `lg`.
  Cada item é `rounded-lg border bg-card`: posição em círculo `primary`,
  contato/empresa/telefone e a espera em `tabular-nums` com ícone de relógio
  (`mm:ss`; `h:mm:ss` a partir de 1 h). O CNPJ vai junto da empresa e nunca
  quebra no meio do número (`whitespace-nowrap`); resumo da Transferência em
  `text-sm` e "Fila de um usuário" em `text-sm muted` quando a Fila é de um
  usuário (destino fixo ocupado).
  Abaixo de `xl` a barra some e o cartão da Fila entra no dock.
- **Aviso de status** (`AvisoDeStatus`): feedback de envio/transferência no
  painel e no campo de resposta. Segue "Indicadores de estado": ícone
  (`AlertCircle`/`CheckCircle2`) + texto + cor, erro em `destructive` e sucesso
  em `primary` (nunca `success`, o dourado do selo "em dia").

### Telas de aviso e carregamento

`TelaDeAvisoPage` (erro inesperado em `app/error.tsx`, rota inexistente em `app/not-found.tsx`) reaproveita o
`EntradaTemplate` do login: marca, subtítulo que diz o que houve, um `AvisoDeStatus` de erro em `text-sm`
(ícone + texto, `role="alert"`), as ações e um rodapé. O erro nunca mostra `error.message`; oferece "Tentar de
novo" e "Ir para o início". `CarregandoPage` (`app/loading.tsx`) é um `role="status"` com spinner
`motion-safe` e "Carregando…"; só aparece depois de 250 ms (`animate-carregando`, um atraso de opacidade sem
movimento, por isso sem `motion-safe:`), para a navegação rápida não piscar.

### Dock de Atendimentos (#49)

Cartões fixos no canto inferior direito (`fixed right-4 bottom-4`), um por
Atendimento em andamento: ícone, Contato, empresa e o começo da última
mensagem (prefixo "Você:" / "URA:" quando não é do cliente). Quando o cliente
escreveu por último o cartão ganha uma bolinha `destructive` e a prévia em
`font-medium` (e "nova mensagem" só para leitor de tela); o contêiner é
`aria-live="polite"` e fica acima da safe-area de aparelhos com barra
inferior (`bottom-[max(1rem,env(safe-area-inset-bottom))]`). O cartão entra com `animate-dock-entrada` (sobe e aparece, 0,35 s,
`cubic-bezier(0.16, 1, 0.3, 1)`, keyframes em `globals.css`) e é recriado a cada mensagem nova, repetindo a
animação. O aviso sonoro (dois tons curtos) toca quando surge um Atendimento
ou o cliente escreve de novo.

## Estados e motion

- Loading do formulário de login: label muda para "Entrando…" e um
  `Loader2` gira (`motion-safe:animate-spin`) — o estado real (texto +
  `disabled`) não depende da animação, então `prefers-reduced-motion` apenas
  remove o giro sem perder informação. O cadastro de Líder/Funcionário e a
  troca de senha (#31) seguem o mesmo padrão ("Cadastrando…" /
  "Trocando…").
- Erro de servidor: bloco com borda/ícone `destructive`, `role="alert"`.
- Sucesso de salvar no cadastro operacional: `role="status"` (anunciado por
  leitor de tela, ao contrário de um `<p>` mudo).
- Alvos de toque: **todo controle** (`Input`, `Select`, `FileInput`, `Button` em todos os tamanhos)
  tem 36 px (32 px no `sm`) com mouse e sobe para 44 px em aparelho de toque (`pointer-coarse:h-11`;
  `pointer-coarse:min-h-11` no "Voltar" e nas abas do shell). **Decisão de 21/10/2026, revisa os
  44 px fixos anteriores**: controles de 44 px em tela de mouse deixavam o formulário largo e
  alto demais. Com mouse o piso é de 24 px (WCAG 2.5.8): o "Voltar" tem `min-h-6`.
- Entrada do cartão do dock de Atendimentos: `motion-safe:animate-dock-entrada`.
  O estado (destaque, prévia, "nova mensagem") não depende da animação nem do
  som: quem pediu movimento reduzido ou está sem som perde só o enfeite.
- Aviso sonoro: só quando há novidade (Atendimento novo ou cliente escreveu
  de novo; resposta nossa ou da URA e a primeira leitura da tela são
  silenciosas). Navegadores bloqueiam som antes do primeiro clique/tecla da
  página; até lá o aviso é mudo, sem erro.

### Cadastro de Cliente e documentos contratuais (decisões de 21/10/2026; #33, #108, #138–#141)

Estas decisões revisam registros anteriores deste arquivo (larguras de 80%/90%, controles de 44 px
fixos, campo travado em cor plena, diálogo e lista das alterações); onde há conflito, vale esta seção.

- **Cadastro de Cliente em colunas**: largura `cadastro`; em `lg`, 4 colunas (CNPJ, Empresa em 2,
  Regime; E-mail em 2; Contrato social em 1; cada alteração numa fileira com nº, data e arquivo em
  2, e a dica do nº embaixo, na largura da linha). Em `sm`, 2 colunas; no celular, 1. "Cadastrar"
  tem o tamanho do rótulo e fica à direita.
- **Limpar (cadastro de Cliente)**: botão `destructive` à esquerda de "Cadastrar". Ao contrário do
  "Limpar" da edição (que volta ao valor do servidor), este **esvazia tudo**: campos, contrato,
  alterações, avisos da consulta de CNPJ e erro do servidor, sem cadastrar. **Com algo preenchido
  pede confirmação** inline: a linha dos botões troca por "Limpar o formulário? O que foi preenchido
  e os arquivos escolhidos serão descartados." (`role="alert"`) com "Voltar" (foco inicial, o lado
  seguro) e "Limpar tudo" (o botão repete a ação, não "Sim"); formulário em branco
  limpa direto. Enviar cancela o pedido.
- **Teto de arquivos**: a soma de contrato e alterações vai numa só Server Action e o Next corta
  em 11 MB (`bodySizeLimit`); o schema barra acima de 10 MB com a mensagem "Os arquivos somam X,Y MB
  e o limite é 10 MB. Envie arquivos menores ou anexe as alterações depois do cadastro." (total real e
  saída, não só "mais de 10 MB"). O erro é do conjunto: usa o caminho `documentos` e aparece sob o
  título "Documentos", não sob o Contrato social.
- **Dica de formato no campo de arquivo**: o `FileInput` aceita `dica` ("PDF ou DOCX"), uma linha
  `text-xs` sob "ou clique para selecionar", para o formato ser dito antes de escolher e não só no erro. As instruções
  e a dica ficam `aria-hidden` (o rótulo do campo já o nomeia); só o nome do arquivo escolhido entra no
  nome acessível, por ser o estado.
- **Falha da Server Action**: rejeição vira mensagem pela causa (`TypeError` = sem conexão;
  `NotReadableError` = arquivo ilegível, ex.: ainda só na nuvem do OneDrive; demais = erro
  inesperado, com o erro completo no console). O texto "verifique a conexão" não é mais o padrão
  para tudo.
- **Documento contratual (#140)**: cartão fixo no formulário de editar Cliente, **sem diálogo e sem
  seletor** (revisa o diálogo com "Escolher documento"): ícone, "Contrato social e alterações", o
  documento mais recente (alteração de maior nº, ou o contrato social) e o botão verde
  (`default`) "Abrir em nova aba", que abre o arquivo no primeiro clique. Enquanto carrega, reserva
  `min-h-20`. As alterações antigas não têm lista na tela.
- **Anexar alteração (#141)**: botão `outline` "Anexar alteração" (só Admin) no mesmo cartão, ao
  lado de "Abrir em nova aba"; sem documento algum, aparece sozinho. **Não existe mais a seção
  "Alterações contratuais" abaixo do formulário** (revisa o #141); ficam só o diálogo de anexar
  (fora do `<form>`, para não aninhar formulários, ligado ao botão pelo id do painel) e a
  confirmação depois de anexar ("Alteração nº N anexada."), que aparece **acima do formulário**, colada
  ao cartão do documento que fica no topo dele (antes ficava abaixo, fora da vista). O contêiner do
  diálogo é `display: contents`, para o diálogo fechado não abrir vão acima do formulário.
- **Busca de Cliente por papel**: o Admin, ao escolher um resultado, vai à tela própria
  `/clientes/[id]` (a única com "Anexar alteração"); Líder e Funcionário continuam no painel
  embutido na busca.
- **Rótulo em campo desativado (harden, axe)**: Empresa, CNPJ e Regime da edição têm `id` e o
  `Label` com `htmlFor` (`cabecalho-empresa`, `cabecalho-cnpj`, `cabecalho-regime`). Campo desativado
  sem rótulo associado é lido como "campo de edição" sem nome; o `title` não substitui o rótulo. Medido com
  o axe-core em claro e escuro: sem violações na edição nem no diálogo de anexar.
- **Campos longos e telas estreitas (harden)**: Empresa desativada traz o nome inteiro em `title`
  (o campo trunca); "Atividade do mês" quebra de linha em vez de vazar a 320 px. Medido em 320 px e
  1440 px com nome de empresa de 250+ caracteres e emoji: sem rolagem horizontal no cadastro nem na
  edição.
- **Editar cadastro operacional em 4 colunas**: cabeçalho (Empresa, CNPJ, Regime, Responsável),
  cartão do documento, e Forma de envio, Documento recebido, DAS, Data de envio na mesma linha;
  parcelamento e atividade do mês em 2 colunas cada; Contatos, Observações e as ações na linha
  toda. Abaixo de `lg`, 2 colunas; no celular, 1.
- **Navegação por abas (`ShellNav`)**: só a aba da tela aberta ganha o destaque cheio e
  `aria-current="page"`; em "/" nenhuma está selecionada, e a única com tela (Simples Nacional)
  é um link comum, não parece escolhida.

## O que ainda não existe

- ~~Selo dourado "em dia" (`success`) definido como token mas sem uso visual
  ainda.~~ Em uso desde #36 (ver Componentes → Resumo do setor) — o anel
  "atenção" usa `stroke-success`.
- Componentes `ui/` adicionais além de `select.tsx` (Dialog, uma `Table`
  estilizada para reuso — hoje o feed de auditoria usa `<table>` nativo com
  classes inline) — adicionar sob demanda, seguindo os mesmos tokens.

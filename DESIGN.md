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
**dark** (padrão do produto); a classe `.light` sobrescreve para o tema
claro. `next-themes` (`src/presentation/providers/theme.provider.tsx`)
alterna a classe em `<html>`; `enableSystem` fica desligado para não
sobrepor "dark é o padrão" com a preferência de SO do visitante.

| Token | Dark (padrão) | Light | Uso |
|---|---|---|---|
| `background` / `foreground` | `#23221f` / `#ece7d8` | `#f4f1e8` / `#16231f` | tela |
| `card` / `card-foreground` | `#2c2a26` / `#ece7d8` | `#faf8f1` / `#16231f` | superfícies elevadas (cartão de login, painel de filtro, cartão de confirmação) |
| `primary` / `primary-foreground` | `#54a292` / `#0a1613` | `#0d3b36` / `#f4f1e8` | verde-cheque — ação principal, e estado "sucesso" em listas/feeds e confirmações |
| `secondary`, `muted`, `accent` | tons de papel/verde desaturados | idem | hierarquia secundária, hover |
| `destructive` / `destructive-foreground` | `#e0968c` / `#2a0f0c` | `#7a2b2b` / `#f4f1e8` | erro/atenção — sempre com ícone, nunca só cor; também estado "falha" em listas/feeds |
| `success` / `success-foreground` | `#d9bd7c` / `#2a1f0c` | `#96742f` / `#2a1f0c` | selo dourado "em dia" — reservado especificamente para as telas de status do Simples Nacional (#35–#37); não usar para resultado sucesso/falha genérico (isso é `primary`/`destructive`, ver Componentes → Indicadores de estado) |
| `border` / `input` / `ring` | `#47453e` | tons de contorno derivados do verde | bordas, campos, foco |

**Dark "leve" (revisão de 28/09/2026, duas rodadas):** a paleta dark original
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
sem asset de imagem, tileable, 100% CSS. Usada com moderação: hoje só no
cartão de login; o painel de cliente do dashboard Simples Nacional é o
próximo consumidor natural.

## Layout

Telas Operate autenticadas (`ShellHeader` + conteúdo) usam um container
centralizado com padding lateral (`px-4 sm:px-6`); a largura máxima segue a
densidade real do conteúdo, não um valor único fixo do produto:

- Formulário isolado (ex.: cartão de login, cadastro de Líder/Funcionário
  pelo Admin ou pelo Líder de setor — escopado por RBAC no caso de uso, #32
  —, troca de senha): `max-w-md`, conteúdo único centralizado.
- Feed/tabela com filtro (ex.: `/admin/auditoria`): `max-w-6xl` — largura
  suficiente para a grade de filtro de 4 colunas e as 6 colunas da tabela
  sem espremer nem forçar rolagem horizontal prematura.

Painel de filtro: campos em grid (`grid-cols-2 sm:grid-cols-4`), e as ações
(Limpar/Filtrar) ficam numa linha própria abaixo dos campos, separada por
`border-t` — nunca misturadas na mesma linha de grid que um campo de
entrada (ação e dado de filtro são grupos distintos).

## Componentes

`src/presentation/components/ui/` — primitivas estilo shadcn (kebab-case,
sem sufixo `.component`, isentas de teste por convenção —
`docs/testes.md`):

- `button.tsx` — variantes `default`/`destructive`/`outline`/`ghost`,
  tamanhos `default` (44px), `sm` (40px), `icon` (44px). Alturas escolhidas
  para bater o alvo de toque de 44px em controles primários. Exporta
  `buttonVariants` (a função `cva` por trás do componente) para qualquer
  elemento que precise da mesma aparência sem ser um `<button>` de verdade —
  o link "Trocar senha" do `ShellHeader` é o primeiro consumidor
  (`buttonVariants({ variant: "ghost", size: "sm" })` num `<Link>`), evitando
  reimplementar as classes do ghost/sm à mão. Qualquer link estilizado como
  botão reusa `buttonVariants` em vez de duplicar classes.

  **Rótulo de ação oculto abaixo de `sm` (revisão de 28/09/2026, #32):** os
  links de ação do `ShellHeader` (hoje "Cadastrar Líder"/"Cadastrar
  Funcionário" e "Trocar senha") escondem o texto do rótulo em telas
  estreitas (`<span className="hidden sm:inline">`) mantendo só o ícone —
  necessário porque o header ganhou um terceiro link de ação neste ticket, e
  o rótulo completo dos três (mais o toggle de tema e "Sair") não cabe em
  larguras de celular sem rolagem horizontal. `aria-label` no próprio
  `<Link>` preserva o nome acessível igual ao texto visível em telas largas;
  o ícone sozinho nunca carrega o significado sem esse rótulo. Qualquer novo
  link de ação no header segue o mesmo padrão em vez de forçar o texto
  sempre visível.

  **Extensão (29/09/2026, #33):** o link "Cadastrar Cliente" (ícone
  `Building2`, visível só pro papel Admin) segue exatamente esse padrão —
  confirma que a regra vale para qualquer novo link, não só os três
  documentados em #32.
- `input.tsx` — 44px de altura; `aria-invalid` troca borda/anel para
  `destructive` automaticamente.

  **Campo de arquivo sempre com `Label` visível (29/09/2026, #33):** o
  cadastro de Cliente introduziu os primeiros `<Input type="file">` do
  produto (contrato social e cada alteração contratual). O primeiro rascunho
  usava `aria-label` sozinho no arquivo de cada alteração contratual, sem
  `Label` visível — inconsistente com todo outro campo do formulário, que
  sempre tem rótulo visível emparelhado por `htmlFor`/`id`. Corrigido na
  revisão impeccable: todo campo de arquivo usa `Label htmlFor` + `Input id`
  como qualquer outro campo, sem depender só de `aria-label`. **Superado
  pelo `file-input.tsx` abaixo** (feedback manual do usuário, mesma data) —
  o contrato de `Label htmlFor`/`id` continua valendo, só o controle em si
  deixou de ser um `<input type="file">` nu.
- `file-input.tsx` (29/09/2026, #33, feedback manual do usuário — "o layout
  está muito simples"): `<input type="file">` nativo não aceita ser
  estilizado diretamente ("Choose File / No file chosen" do navegador era o
  único controle do produto fora do sistema de design). Substituído por um
  `<label>` do tamanho de `input.tsx`/`select.tsx` (44px, borda, raio, cores
  do tema) envolvendo o input real como `sr-only` — mesmo padrão acessível
  de sempre (o label aciona o seletor de arquivo do SO; foco por teclado no
  input escondido acende o anel via `has-[:focus-visible]` no label). Ícone
  `Upload` cinza + "Selecionar arquivo…" no estado vazio; `FileText` verde
  (`text-primary`) + nome do arquivo depois de selecionado — mesmo
  vocabulário de ícone-substitui-estado já usado em Indicadores de estado.
  Qualquer novo campo de arquivo do produto reusa este componente em vez de
  um `<Input type="file">` cru.

  **Seção "Documentos" (29/09/2026, #33):** contrato social e alterações
  contratuais ganharam um agrupamento visual próprio — `border-t` +
  `pt-6` + heading `text-sm font-semibold uppercase text-muted-foreground`
  ("DOCUMENTOS"), separando os campos de identificação do Cliente (CNPJ,
  Empresa, Regime) dos campos de documento. Mais espaço acima do heading que
  abaixo, mesma cadência do resto do produto. Qualquer formulário futuro com
  dois grupos de campos claramente distintos (identificação vs. anexos, por
  exemplo) reusa esse padrão de divisor em vez de um `<hr>` genérico ou um
  segundo cartão.
- `select.tsx` — mesmo tratamento visual do `input.tsx` (44px, mesmas
  bordas/foco, e o mesmo `aria-invalid` para borda/anel `destructive`).
  Introduzido no feed de auditoria para eliminar classes Tailwind duplicadas
  entre os dois `<select>` do filtro (Setor, Resultado); o cadastro de
  Líder/Funcionário (#30, campos Papel/Setor) foi o primeiro consumidor a
  marcar `aria-invalid` num `<select>`, o que expôs a falta do tratamento de
  erro no componente — corrigido no próprio `select.tsx` em vez de um
  ajuste local, para qualquer select de formulário futuro herdar o mesmo
  contrato de erro do `input.tsx`. Qualquer novo select do produto reusa
  este componente em vez de repetir as classes inline.

  **Campo travado quando só há 1 opção válida (28/09/2026, #32):** no
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

  **Sem opacidade de desabilitado (revisão impeccable, 28/09/2026):** o
  `disabled:opacity-50` padrão de `select.tsx` existe pra sinalizar "campo
  indisponível" — o oposto do que esse padrão precisa comunicar ("aqui está
  o que vai ser cadastrado", uma confirmação, não uma ausência). Por isso
  esses dois `<select>` passam `className="disabled:opacity-100"` pra
  sobrescrever a opacidade herdada e manter o texto na cor plena — o cursor
  `not-allowed` (herdado, mantido) já basta pra sinalizar "sem interação
  aqui". Qualquer campo futuro que reuse o padrão de campo travado acima
  reusa também esse override.
- `label.tsx`, `field-error.tsx` — erro de campo sempre ícone (`AlertCircle`)
  + texto + cor, nunca só cor (contrato "Talão de Cheque": estado por
  padrão/ícone além de cor).
- `theme-toggle.tsx` — único ponto de troca de tema, hoje vive no
  `ShellHeader`; o login não tem toggle (decisão desta rodada — ver relatório
  do pipeline).

Ícones: `lucide-react`, traço único consistente — nunca emoji/glyph Unicode
como ícone (ex.: link "Voltar" usa `ArrowLeft`, não o caractere "←";
reusado no cadastro de Líder/Funcionário).

### Indicadores de estado (sucesso/falha)

O mesmo contrato do `field-error.tsx` (ícone + texto + cor, nunca só cor) se
estende a qualquer indicador de resultado, não só erro de formulário nem só
listas. No feed de auditoria, a coluna "Resultado" combina
`CheckCircle2`/`XCircle` + o texto (`sucesso`/`falha`) +
`text-primary`/`text-destructive`. O cadastro de Líder/Funcionário (#30)
reusa o mesmo par `CheckCircle2` + `text-primary` na mensagem de confirmação
de conta criada, fora de uma lista — confirma que o contrato é de indicador
de resultado em geral, não específico de tabela. `success` (dourado) fica
reservado ao selo "em dia" do Simples Nacional — não se usa aqui para não
sobrepor dois significados no mesmo token.

### Ações pós-sucesso (confirmação de cadastro)

**"Cadastrar outro" / "Finalizar" (28/09/2026, #32):** a tela de
confirmação do cadastro de Líder/Funcionário (senha provisória exibida)
ganhou duas ações lado a lado — `Button` primário "Cadastrar outro"
(ícone `UserPlus`, limpa Nome/E-mail e devolve o formulário pronto pra um
novo cadastro, mantendo Papel/Setor travados quando aplicável) e um
`<Link>` estilizado com `buttonVariants({ variant: "outline" })` "Finalizar"
(ícone `Check`) que leva pra `/`. `/` é provisório: ainda não existe uma
tela própria do Setor pra voltar (mesma situação já registrada para o link
"Trocar senha" do `ShellHeader`, #31) — trocar o destino quando essa tela
existir, sem mudar o padrão dos dois botões em si. Vale pra qualquer tela
futura de cadastro em lote (ex.: Cadastro de Cliente, #33): oferecer
continuar sem sair, e um jeito explícito de encerrar.

**Confirmado em #33:** o cadastro de Cliente reusa o mesmo par de botões
sem alteração — `Button` primário "Cadastrar outro" (ícone `UserPlus`,
limpa o formulário e reseta a lista de alterações contratuais) e `<Link>`
"Finalizar" pra `/`, mesma justificativa provisória do destino.

### Lista de itens repetíveis (campo dinâmico)

**Alterações contratuais (29/09/2026, #33):** primeiro uso de
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

## Estados e motion

- Loading do formulário de login: label muda para "Entrando…" e um
  `Loader2` gira (`motion-safe:animate-spin`) — o estado real (texto +
  `disabled`) não depende da animação, então `prefers-reduced-motion` apenas
  remove o giro sem perder informação. O cadastro de Líder/Funcionário e a
  troca de senha (#31) seguem o mesmo padrão ("Cadastrando…" /
  "Trocando…").
- Erro de servidor: bloco com borda/ícone `destructive`, `role="alert"`.

## O que ainda não existe

- Selo dourado "em dia" (`success`) definido como token mas sem uso visual
  ainda — pertence às telas do setor Simples Nacional (#35–#37).
- Componentes `ui/` adicionais além de `select.tsx` (Dialog, uma `Table`
  estilizada para reuso — hoje o feed de auditoria usa `<table>` nativo com
  classes inline) — adicionar sob demanda, seguindo os mesmos tokens.

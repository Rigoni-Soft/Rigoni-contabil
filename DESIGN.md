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
| `background` / `foreground` | `#0c1512` / `#ece7d8` | `#f4f1e8` / `#16231f` | tela |
| `card` / `card-foreground` | `#12201c` / `#ece7d8` | `#faf8f1` / `#16231f` | superfícies elevadas (cartão de login) |
| `primary` / `primary-foreground` | `#4a9686` / `#0a1613` | `#0d3b36` / `#f4f1e8` | verde-cheque — ação principal |
| `secondary`, `muted`, `accent` | tons de papel/verde desaturados | idem | hierarquia secundária, hover |
| `destructive` / `destructive-foreground` | `#e0968c` / `#2a0f0c` | `#7a2b2b` / `#f4f1e8` | erro/atenção — sempre com ícone, nunca só cor |
| `success` / `success-foreground` | `#d9bd7c` / `#2a1f0c` | `#96742f` / `#2a1f0c` | selo "em dia" — reservado para telas de status (ainda não usado no login/shell) |
| `border` / `input` / `ring` | tons de contorno derivados do verde | idem | bordas, campos, foco |

`primary-foreground` do dark theme usa tinta quase-preta (não branco): o
verde-cheque claro (#4a9686) só atinge ~6:1 de contraste com texto escuro
contra ~3.5:1 com branco — medido e escolhido por esse motivo, não por
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

## Componentes

`src/presentation/components/ui/` — primitivas estilo shadcn (kebab-case,
sem sufixo `.component`, isentas de teste por convenção —
`docs/testes.md`):

- `button.tsx` — variantes `default`/`destructive`/`outline`/`ghost`,
  tamanhos `default` (44px), `sm` (40px), `icon` (44px). Alturas escolhidas
  para bater o alvo de toque de 44px em controles primários.
- `input.tsx` — 44px de altura; `aria-invalid` troca borda/anel para
  `destructive` automaticamente.
- `label.tsx`, `field-error.tsx` — erro de campo sempre ícone (`AlertCircle`)
  + texto + cor, nunca só cor (contrato "Talão de Cheque": estado por
  padrão/ícone além de cor).
- `theme-toggle.tsx` — único ponto de troca de tema, hoje vive no
  `ShellHeader`; o login não tem toggle (decisão desta rodada — ver relatório
  do pipeline).

Ícones: `lucide-react`, traço único consistente — nunca emoji/glyph Unicode
como ícone.

## Estados e motion

- Loading do formulário de login: label muda para "Entrando…" e um
  `Loader2` gira (`motion-safe:animate-spin`) — o estado real (texto +
  `disabled`) não depende da animação, então `prefers-reduced-motion` apenas
  remove o giro sem perder informação.
- Erro de servidor: bloco com borda/ícone `destructive`, `role="alert"`.

## O que ainda não existe

- Selo dourado "em dia" (`success`) definido como token mas sem uso visual
  ainda — pertence às telas do setor Simples Nacional (#35–#37).
- Componentes `ui/` adicionais (Select, Dialog, Table…) — adicionar sob
  demanda, seguindo os mesmos tokens.

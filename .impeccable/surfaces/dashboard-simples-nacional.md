---
version: 1
slug: "dashboard-simples-nacional"
primary_target: "dashboard-simples-nacional"
related_targets: []
---

## Scope

Dashboard do setor Simples Nacional (tickets #8, #9, #10, #35–#37) — Operate mode. Primeiro mundo visual do sistema; nenhuma superfície anterior tem autoridade (o protótipo de artifact anterior foi rejeitado pelo usuário).

## Audience, job, action, proof, constraints

Funcionário do setor Simples Nacional, checando a saúde de ~342 clientes (documentos, DAS, parcelamento) várias vezes ao dia, agindo direto sobre o que vê (drill-down, edição inline). Prova: os números batem com o cadastro real. Restrições técnicas fixas (não decisão de marca): Roboto única fonte, tokens semânticos, tons pastel, temas dark/light obrigatórios (`docs/arquitetura.md` §5).

## Direction contract

THESIS: O dashboard trata cada cliente como uma folha de talão bancário — o guilhochê que prova autenticidade em documentos financeiros vira a moldura visual da confiança, recusando o clichê de "SaaS financeiro" com ícone de cofre/escudo.

OWN-WORLD: Verde-cheque profundo (#0d3b36) como base/acento, papel de segurança creme (#f4f1e8) nas superfícies, selo dourado (#96742f claro / #d9bd7c escuro — token `success`) marcando "em dia". Bordas finas de guilhochê (linha de segurança, não decoração) emolduram cards e o painel de cliente. Roboto, números em tabular-nums. Estado sempre marcado por padrão de selo/traço além da cor (raise do Jackfield) — nunca só a cor carrega o significado. Acento de atenção/urgente reservado, nunca espalhado (raise do Cassete).

STORY: O funcionário abre o dashboard e reconhece, sem precisar pensar, "isso é sério, isso passou por verificação" — cada anel de status é um selo carimbado, nunca um ícone genérico de painel.

FIRST VIEWPORT: Sidebar verde-cheque escuro com os setores (Simples Nacional ativo, demais desabilitados); topo com busca; seção "Resumo do setor" com os 11 cards emoldurados em guilhochê fino, anel central onde ficaria o valor por extenso do cheque; seção "Comparativos" com os donuts na mesma moldura; seção "Buscar cliente" com o painel do cliente selecionado como se fosse a própria folha do talão preenchida.

FORM: Talão de Cheque (model-pick / IMPECCABLE'S PICK), candidato #1 da lista ordenada por ressonância (à frente do sorteado, Livro Razão, que doou as marcações de estado por traço/padrão). Seed key: afb48a0e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions

Nenhuma — as duas abaixo foram resolvidas durante a implementação do #28 (e a paleta dark foi revisada de novo em 28/09/2026). `DESIGN.md` é a fonte da verdade corrente; atualize aqui só se a direção em si mudar, não os valores.

- ~~Exato tom de verde-cheque e dourado ainda não validado contra os tokens shadcn (dark/light) — a construir.~~ Validado e documentado em `DESIGN.md` (seção Tokens).
- ~~Como o guilhochê é desenhado tecnicamente (SVG pattern gerado vs. asset) — decisão de implementação, não de direção.~~ CSS puro via `mask-composite: exclude`, documentado em `DESIGN.md` (seção Guilhochê).

// Organograma real, exceto Patriki (raiz) e Expedição. Presumido/Real -> Tributário.
// Zeladoria é subtime de Financeiro, não setor próprio de login — decisão definitiva,
// confirmada com o usuário na revisão do #28 (CONTEXT.md, termo "Setor").
// Contábil Externo é o mesmo setor que Contábil (não dois setores) e T.I. não é setor
// próprio (cai dentro de Administrativo, mesmo padrão da Zeladoria) — decisão definitiva,
// confirmada com o usuário em 28/09/2026.
// ponytail: o enum `setor_slug` do Postgres (migration do #28) ainda lista
// `contabil_externo`/`ti` porque essa correção não tocou o #28 (já em revisão externa);
// são valores mortos, nunca aceitos por este validador — remover do enum quando o #28
// puder ser editado de novo (após merge).
// Fica em shared (não em usuarios/domain) porque Views globais também precisam da lista
// e não podem importar de dentro de um módulo (arquitetura.md, seção 3.4).
export const SETORES = [
  "rh",
  "tributario",
  "simples_nacional",
  "contabil",
  "societario",
  "condominios",
  "financeiro",
  "administrativo",
  "recepcao",
] as const;
export type SetorSlug = (typeof SETORES)[number];

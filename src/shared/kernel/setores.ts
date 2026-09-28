// Organograma real, exceto Patriki (raiz) e Expedição. Presumido/Real -> Tributário.
// Zeladoria é subtime de Financeiro, não setor próprio de login — decisão definitiva,
// confirmada com o usuário na revisão do #28 (CONTEXT.md, termo "Setor").
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
  "contabil_externo",
  "ti",
  "recepcao",
] as const;
export type SetorSlug = (typeof SETORES)[number];

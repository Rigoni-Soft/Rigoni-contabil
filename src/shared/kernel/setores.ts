// Organograma real, exceto Patriki (raiz) e Expedição. Presumido/Real -> Tributário.
// Zeladoria é subtime de Financeiro, não setor próprio de login — decisão definitiva,
// confirmada com o usuário na revisão do #28 (CONTEXT.md, termo "Setor").
// Contábil Externo é o mesmo setor que Contábil (não dois setores) e T.I. não é setor
// próprio (cai dentro de Administrativo, mesmo padrão da Zeladoria) — decisão definitiva,
// confirmada com o usuário em 28/09/2026.
// O enum `setor_slug` do Postgres foi alinhado a esta lista pela migration
// 20260929180000_setor_slug_remove_setores_mortos.sql (ajuste 04 da devolutiva
// técnica da PR #60) — `contabil_externo`/`ti` removidos do banco também.
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

// Para valores que chegam como string (sessão, `<select>`) e precisam virar SetorSlug sem cast.
export const ehSetor = (valor: string): valor is SetorSlug =>
  (SETORES as readonly string[]).includes(valor);

// Record<string, ...> solto (não Record<SetorSlug, ...>) de propósito: quem exibe o
// rótulo recebe o slug como string crua (vem de um DTO), então indexar com SetorSlug
// exigiria um cast no ponto de leitura sem ganho real — a exaustividade já é
// garantida por SETORES acima, não precisa duplicar aqui.
export const SETOR_LABEL: Record<string, string> = {
  rh: "RH",
  tributario: "Tributário",
  simples_nacional: "Simples Nacional",
  contabil: "Contábil",
  societario: "Societário",
  condominios: "Condomínios",
  financeiro: "Financeiro",
  administrativo: "Administrativo",
  recepcao: "Recepção",
};

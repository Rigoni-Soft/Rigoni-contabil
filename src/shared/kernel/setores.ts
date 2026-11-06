// Organograma real, exceto Patriki (raiz) e Expedição. Presumido/Real -> Tributário.
// Zeladoria é subtime de Financeiro, não setor próprio de login. Contábil Externo é o mesmo setor que
// Contábil (não dois setores) e T.I. não é setor próprio (cai dentro de Administrativo, mesmo padrão
// da Zeladoria) — decisões definitivas (CONTEXT.md, termo "Setor").
// O enum `setor_slug` do Postgres está alinhado a esta lista (migration
// 20260924190000_usuarios_e_auditoria.sql): `contabil_externo`/`ti` saíram do banco também.
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

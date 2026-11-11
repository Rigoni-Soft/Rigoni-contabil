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

// Setor RH nomeado: renomear o slug em SETORES quebra a compilação onde as regras o citam.
export const SETOR_RH = "rh" satisfies SetorSlug;
// Setor Recepção nomeado, como o RH: a espera dela é comum, sem Responsável por Cliente.
export const SETOR_RECEPCAO = "recepcao" satisfies SetorSlug;
// Setor Simples Nacional nomeado, como o RH.
export const SETOR_SN = "simples_nacional" satisfies SetorSlug;
// Rota do resumo do Setor Simples Nacional.
export const ROTA_SN = "/simples-nacional";
// Rota do resumo do Setor RH (a aba "RH" da navegação).
export const ROTA_RH = "/rh";
// Rota do acompanhamento de um Funcionário do RH (`/<id>` no fim).
export const ROTA_RH_FUNCIONARIOS = `${ROTA_RH}/funcionarios`;
// Rota dos serviços do acompanhamento do RH (item do menu de configuração).
export const ROTA_RH_SERVICOS = `${ROTA_RH}/servicos`;
export const ROTA_RH_FOLHA_DE_PONTO = `${ROTA_RH}/folha-de-ponto`;
// Setores com tela própria e a rota dela. String solta de propósito: quem consulta recebe o slug cru.
export const ROTA_POR_SETOR: Record<string, string> = {
  [SETOR_SN]: ROTA_SN,
  [SETOR_RH]: ROTA_RH,
};

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

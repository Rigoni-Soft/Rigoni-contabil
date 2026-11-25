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

export const SETOR_RH = "rh" satisfies SetorSlug;
export const SETOR_RECEPCAO = "recepcao" satisfies SetorSlug;
export const SETOR_SN = "simples_nacional" satisfies SetorSlug;
export const ROTA_SN = "/simples-nacional";
export const ROTA_RH = "/rh";
export const ROTA_RH_FUNCIONARIOS = `${ROTA_RH}/funcionarios`;
export const ROTA_RH_SERVICOS = `${ROTA_RH}/servicos`;
export const ROTA_RH_FOLHA_DE_PONTO = `${ROTA_RH}/folha-de-ponto`;
export const ROTA_POR_SETOR: Record<string, string> = {
  [SETOR_SN]: ROTA_SN,
  [SETOR_RH]: ROTA_RH,
};

export const ehSetor = (valor: string): valor is SetorSlug =>
  (SETORES as readonly string[]).includes(valor);

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

// Rótulos e valores de Regime tributário — mesmo motivo de SETORES/PAPEIS:
// domain (clientes) e Views globais (form de cadastro de Cliente) precisam da
// mesma lista, sem poder importar de dentro do módulo clientes (arquitetura.md, seção 3.4).
// CONTEXT.md, termo "Regime": nesta rodada todo Cliente cadastrado é Simples
// Nacional, mas o campo aceita os quatro valores.
export const REGIMES = ["simples_nacional", "lucro_presumido", "lucro_real", "mei"] as const;
export type RegimeValor = (typeof REGIMES)[number];

export const REGIME_LABEL: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

// Cadastro operacional SN só existe para estes Regimes (CONTEXT.md, "Cadastro operacional");
// o banco repete a regra.
export function regimeTemCadastroOperacionalSn(regime: string): boolean {
  return regime === "simples_nacional" || regime === "mei";
}

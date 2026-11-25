export const REGIMES = ["simples_nacional", "lucro_presumido", "lucro_real", "mei"] as const;
export type RegimeValor = (typeof REGIMES)[number];

export const REGIME_LABEL: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

export function regimeTemCadastroOperacionalSn(regime: string): boolean {
  return regime === "simples_nacional" || regime === "mei";
}

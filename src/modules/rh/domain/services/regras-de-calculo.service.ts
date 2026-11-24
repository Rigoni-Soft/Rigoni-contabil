import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

export type RegrasDeCalculo = {
  extraUtilPct: number;
  extraSabadoPct: number;
  extraDomingoPct: number;
  extraFeriadoPct: number;
  limiteExtrasDiaMin: number;
  datasEspeciais: { data: string; percentual: number }[];
  bancoDeHoras: boolean;
  trabalhoAosDomingos: boolean;
};

export const LEGISLACAO: RegrasDeCalculo = {
  extraUtilPct: 50,
  extraSabadoPct: 50,
  extraDomingoPct: 100,
  extraFeriadoPct: 100,
  limiteExtrasDiaMin: 120,
  datasEspeciais: [],
  bancoDeHoras: false,
  trabalhoAosDomingos: false,
};

export type InterruptoresDeCalculo = { bancoDeHoras: boolean; trabalhoAosDomingos: boolean };

export function regrasDeCalculo(
  convencao: RegrasDaConvencao | null,
  interruptores: InterruptoresDeCalculo,
  comissionado: boolean,
): RegrasDeCalculo {
  const regras: RegrasDeCalculo = { ...LEGISLACAO, ...interruptores, datasEspeciais: [] };
  for (const regra of convencao?.aplicadas ?? []) {
    if (regra.chave === "extra_sabado") {
      regras.extraSabadoPct = regra.valor;
      continue;
    }
    if (regra.chave === "limite_extras_dia") {
      regras.limiteExtrasDiaMin = regra.valor;
      continue;
    }
    if (regra.chave !== "datas_especiais") continue;
    for (const dataEspecial of regra.valor) {
      const { data, percentual: padrao, percentualComissionado } = dataEspecial;
      const percentual = comissionado ? (percentualComissionado ?? padrao) : padrao;
      if (data === null) {
        regras.extraFeriadoPct = percentual;
        continue;
      }
      regras.datasEspeciais.push({ data, percentual });
    }
  }
  return regras;
}

export type ConvencaoDaEpoca = {
  sindicato: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  regras: RegrasDaConvencao;
};

export function convencaoDaEpoca<T extends ConvencaoDaEpoca>(
  convencoes: readonly T[],
  sindicato: string | null,
  data: string,
): T | null {
  const vigentes = convencoes.filter(
    (c) =>
      c.vigenciaInicio <= data &&
      data <= c.vigenciaFim &&
      (!sindicato || c.sindicato === sindicato),
  );
  if (!sindicato && new Set(vigentes.map((c) => c.sindicato)).size > 1) return null;
  return vigentes.reduce<T | null>(
    (melhor, c) => (!melhor || c.vigenciaInicio > melhor.vigenciaInicio ? c : melhor),
    null,
  );
}

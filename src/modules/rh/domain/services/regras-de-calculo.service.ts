import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

// O que o motor da Totalização lê: a legislação padrão, com por cima o que a convenção vigente decidiu e o
// que o Responsável do RH ligou no Cliente. Só parâmetros que mudam o cálculo; jornada e intervalos vêm do
// empregado e das batidas.
export type RegrasDeCalculo = {
  // Hora extra de dia útil, em percentual.
  extraUtilPct: number;
  extraSabadoPct: number;
  // Hora extra de domingo e a de feriado sem data fixa na convenção.
  extraDomingoPct: number;
  extraFeriadoPct: number;
  limiteExtrasDiaMin: number;
  // Datas fixas da convenção ("DD/MM"), já com o percentual do comissionado ou do comum.
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

// Sem convenção (`null`) vale a legislação; os interruptores do Cliente valem em qualquer caso.
export function regrasDeCalculo(
  convencao: RegrasDaConvencao | null,
  interruptores: InterruptoresDeCalculo,
  comissionado: boolean,
): RegrasDeCalculo {
  const regras: RegrasDeCalculo = { ...LEGISLACAO, ...interruptores, datasEspeciais: [] };
  for (const regra of convencao?.aplicadas ?? []) {
    if (regra.chave === "extra_sabado") regras.extraSabadoPct = regra.valor;
    else if (regra.chave === "limite_extras_dia") regras.limiteExtrasDiaMin = regra.valor;
    else if (regra.chave === "datas_especiais") {
      for (const d of regra.valor) {
        const percentual = comissionado ? (d.percentualComissionado ?? d.percentual) : d.percentual;
        if (d.data === null) regras.extraFeriadoPct = percentual;
        else regras.datasEspeciais.push({ data: d.data, percentual });
      }
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

// A convenção que vale na data: dentro da vigência e, se o empregado aponta um sindicato, a dele. Sem
// ponteiro e com sindicatos diferentes valendo no dia, não há como escolher: cai na legislação (a tela avisa).
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
  // Renovação do mesmo sindicato com datas sobrepostas: vale a de vigência mais recente.
  return vigentes.reduce<T | null>(
    (melhor, c) => (!melhor || c.vigenciaInicio > melhor.vigenciaInicio ? c : melhor),
    null,
  );
}

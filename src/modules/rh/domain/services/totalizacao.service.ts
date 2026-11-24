import {
  LEGISLACAO,
  type RegrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";

export type Par = { entrada: number; saida: number };

export type DiaDoCartao = {
  data: string;
  batidas: Par[];
  extra: Par | null;
  abono: boolean;
  feriado: boolean;
};

export type Jornada = readonly [number, number, number, number, number, number, number];

export type Totalizacao = {
  normaisMin: number;
  extras: { percentual: number; minutos: number }[];
  bancoDeHorasMin: number;
  acimaDoLimiteMin: number;
  noturnoMin: number;
  atrasoMin: number;
  faltas: number;
  abonoDias: number;
  abonoMin: number;
  feriadosTrabalhados: number;
  sabadosTrabalhados: number;
  diasComLanche: number;
};

const TOLERANCIA_POR_MARCACAO = 5;
const TOLERANCIA_POR_DIA = 10;
const JANELAS_NOTURNAS: readonly [number, number][] = [
  [0, 5 * 60],
  [22 * 60, 29 * 60],
];

export function horaParaMinutos(texto: string): number {
  const [horas, minutos] = texto.split(":").map(Number);
  return horas * 60 + minutos;
}

export function diaDaSemana(data: string): number {
  const [ano, mes, diaDoMes] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, diaDoMes)).getUTCDay();
}

export function ehDiaDeTrabalho(cargaMin: number, feriado: boolean): boolean {
  return !feriado && cargaMin > 0;
}

export function diaTemDados(dia: Pick<DiaDoCartao, "batidas" | "extra" | "abono">): boolean {
  return dia.batidas.length > 0 || dia.extra !== null || dia.abono;
}

function intervalo({ entrada, saida }: Par): [number, number] {
  return [entrada, saida <= entrada ? saida + 1440 : saida];
}

function duracao(par: Par): number {
  const [inicio, fim] = intervalo(par);
  return fim - inicio;
}

function minutosNoturnos(pares: Par[]): number {
  let real = 0;
  for (const par of pares) {
    const [inicio, fim] = intervalo(par);
    for (const [inicioDaJanela, fimDaJanela] of JANELAS_NOTURNAS)
      real += Math.max(0, Math.min(fim, fimDaJanela) - Math.max(inicio, inicioDaJanela));
  }
  return Math.round((real * 8) / 7);
}

export function minutosTrabalhados(dia: Pick<DiaDoCartao, "batidas" | "extra">): number {
  return (
    dia.batidas.reduce((soma, p) => soma + duracao(p), 0) + (dia.extra ? duracao(dia.extra) : 0)
  );
}

const ZERO: Totalizacao = {
  normaisMin: 0,
  extras: [],
  bancoDeHorasMin: 0,
  acimaDoLimiteMin: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 0,
  abonoDias: 0,
  abonoMin: 0,
  feriadosTrabalhados: 0,
  sabadosTrabalhados: 0,
  diasComLanche: 0,
};

function faixaDoDia(dia: DiaDoCartao, semana: number, regras: RegrasDeCalculo) {
  const [, mes, diaDoMes] = dia.data.split("-");
  const fixa = regras.datasEspeciais.find((e) => e.data === `${diaDoMes}/${mes}`);
  if (fixa) return { percentual: fixa.percentual, especial: true };
  if (dia.feriado) return { percentual: regras.extraFeriadoPct, especial: true };
  if (semana === 0) return { percentual: regras.extraDomingoPct, especial: true };
  if (semana === 6) return { percentual: regras.extraSabadoPct, especial: false };
  return { percentual: regras.extraUtilPct, especial: false };
}

function faixasOrdenadas(pagas: Map<number, number>): Totalizacao["extras"] {
  return [...pagas]
    .sort(([a], [b]) => a - b)
    .map(([percentual, minutos]) => ({ percentual, minutos }));
}

export function totalizarDia(
  dia: DiaDoCartao,
  jornada: Jornada,
  regras: RegrasDeCalculo = LEGISLACAO,
): Totalizacao {
  const semana = diaDaSemana(dia.data);
  const { percentual, especial } = faixaDoDia(dia, semana, regras);
  const pagas = new Map<number, number>();
  let extrasDoDia = 0;
  let extrasLimitadas = 0;
  let bancoDeHorasMin = 0;

  const somarExtra = (min: number) => {
    if (min <= 0) return;
    extrasDoDia += min;
    if (!especial) extrasLimitadas += min;
    if (!especial && regras.bancoDeHoras) {
      bancoDeHorasMin += min;
      return;
    }
    pagas.set(percentual, (pagas.get(percentual) ?? 0) + min);
  };

  const apurado = apurarDia({ dia, jornada, regras, semana }, somarExtra);
  const trabalhou = dia.extra !== null || dia.batidas.length > 0;
  return {
    ...apurado,
    bancoDeHorasMin,
    extras: faixasOrdenadas(pagas),
    acimaDoLimiteMin: Math.max(0, extrasLimitadas - regras.limiteExtrasDiaMin),
    diasComLanche: extrasDoDia > 0 ? 1 : 0,
    sabadosTrabalhados: semana === 6 && !dia.feriado && trabalhou ? 1 : 0,
  };
}

type ContextoDoDia = {
  dia: DiaDoCartao;
  jornada: Jornada;
  regras: RegrasDeCalculo;
  semana: number;
};

function apurarDia(
  { dia, jornada, regras, semana }: ContextoDoDia,
  somarExtra: (min: number) => void,
): Totalizacao {
  const carga = jornada[semana];
  const base: Totalizacao = {
    ...ZERO,
    noturnoMin: dia.extra ? minutosNoturnos([dia.extra]) : 0,
    feriadosTrabalhados: dia.extra && dia.feriado ? 1 : 0,
  };
  somarExtra(dia.extra ? duracao(dia.extra) : 0);

  const trabalhado = dia.batidas.reduce((soma, p) => soma + duracao(p), 0);
  if (semana === 0 && regras.trabalhoAosDomingos && !dia.feriado) {
    return apurarDomingoTrabalhado(base, dia, trabalhado, somarExtra);
  }
  if (carga === 0 && !dia.feriado) return base;
  if (dia.feriado) return apurarFeriado(base, dia, trabalhado, somarExtra);
  if (dia.batidas.length === 0) return apurarSemBatida(base, dia.abono, carga);
  return apurarComBatidas(base, dia, trabalhado, carga, somarExtra);
}

function apurarDomingoTrabalhado(
  base: Totalizacao,
  dia: DiaDoCartao,
  trabalhado: number,
  somarExtra: (min: number) => void,
): Totalizacao {
  if (trabalhado <= 0) return base;
  somarExtra(trabalhado);
  return { ...base, noturnoMin: base.noturnoMin + minutosNoturnos(dia.batidas) };
}

function apurarFeriado(
  base: Totalizacao,
  dia: DiaDoCartao,
  trabalhado: number,
  somarExtra: (min: number) => void,
): Totalizacao {
  if (trabalhado <= 0) return base;
  somarExtra(trabalhado);
  return {
    ...base,
    feriadosTrabalhados: 1,
    noturnoMin: base.noturnoMin + minutosNoturnos(dia.batidas),
  };
}

function apurarSemBatida(base: Totalizacao, abono: boolean, carga: number): Totalizacao {
  return abono ? { ...base, abonoDias: 1, abonoMin: carga } : { ...base, faltas: 1 };
}

function apurarComBatidas(
  semNoturno: Totalizacao,
  dia: DiaDoCartao,
  trabalhado: number,
  carga: number,
  somarExtra: (min: number) => void,
): Totalizacao {
  const base = { ...semNoturno, noturnoMin: semNoturno.noturnoMin + minutosNoturnos(dia.batidas) };
  const tolerancia = Math.min(TOLERANCIA_POR_MARCACAO * dia.batidas.length * 2, TOLERANCIA_POR_DIA);
  const diferenca = trabalhado - carga;
  if (Math.abs(diferenca) <= tolerancia) return { ...base, normaisMin: carga };
  if (diferenca > 0) {
    somarExtra(diferenca);
    return { ...base, normaisMin: carga };
  }
  const atrasado = { ...base, normaisMin: trabalhado };
  return dia.abono ? { ...atrasado, abonoMin: -diferenca } : { ...atrasado, atrasoMin: -diferenca };
}

export function totalizar(
  dias: DiaDoCartao[],
  jornada: Jornada,
  regrasDoDia: (data: string) => RegrasDeCalculo = () => LEGISLACAO,
): Totalizacao {
  const soma: Totalizacao = { ...ZERO };
  const pagas = new Map<number, number>();
  for (const dia of dias) {
    const doDia = totalizarDia(dia, jornada, regrasDoDia(dia.data));
    for (const { percentual, minutos } of doDia.extras)
      pagas.set(percentual, (pagas.get(percentual) ?? 0) + minutos);
    for (const campo of Object.keys(soma) as (keyof Totalizacao)[]) {
      if (campo !== "extras") soma[campo] += doDia[campo];
    }
  }
  soma.extras = faixasOrdenadas(pagas);
  return soma;
}

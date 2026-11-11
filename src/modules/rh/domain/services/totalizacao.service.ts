// Totalização: a legislação padrão (CLT) com por cima os parâmetros da Convenção coletiva vigente na data do
// dia e os interruptores do Cliente (`RegrasDeCalculo`). Sem convenção, vale a legislação: hora extra de 50%
// em dia útil e de 100% em domingo e feriado, tolerância de 5 min por marcação e 10 por dia, adicional noturno
// das 22h às 5h com hora reduzida. Tudo em minutos; sem relógio. Valores em dinheiro ficam com o holerite: aqui
// saem minutos por faixa e contagens.
// Domingo com Jornada: as horas dentro da carga contam como normais e só o excedente é extra; o domingo
// inteiro virar extra é o interruptor "trabalho aos domingos" do Cliente.
// Não usados aqui: jornada e intervalos da convenção (a Jornada é do empregado), exceções de feriado (sem data
// para casar) e a data móvel da convenção sem a marca de feriado no cartão.

import {
  LEGISLACAO,
  type RegrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";

// Minutos desde 00:00. Saída menor ou igual à entrada = a jornada virou o dia.
export type Par = { entrada: number; saida: number };

export type DiaDoCartao = {
  data: string; // "AAAA-MM-DD"
  batidas: Par[];
  // Coluna Extra do cartão: sempre hora extra, mesmo em dia sem carga.
  extra: Par | null;
  abono: boolean;
  feriado: boolean;
};

// Carga em minutos por dia da semana, domingo = 0; zero = não trabalha nesse dia.
export type Jornada = readonly [number, number, number, number, number, number, number];

export type Totalizacao = {
  normaisMin: number;
  // Hora extra paga, por percentual, do menor para o maior.
  extras: { percentual: number; minutos: number }[];
  // Hora extra de dia útil e sábado que vai para o banco de horas (ligado no Cliente), fora das faixas.
  bancoDeHorasMin: number;
  // O que passou do limite diário de extras em dia útil e sábado; já está nas faixas, é só alerta.
  acimaDoLimiteMin: number;
  // Minutos já com a hora noturna reduzida (52min30s = 60min) dentro de 22h às 5h.
  noturnoMin: number;
  atrasoMin: number;
  faltas: number;
  abonoDias: number;
  abonoMin: number;
  // Contagens para o holerite aplicar os valores em dinheiro.
  feriadosTrabalhados: number;
  sabadosTrabalhados: number;
  // Dias com hora extra (paga ou no banco): dão direito a lanche.
  diasComLanche: number;
};

const TOLERANCIA_POR_MARCACAO = 5;
const TOLERANCIA_POR_DIA = 10;
const JANELAS_NOTURNAS: readonly [number, number][] = [
  [0, 5 * 60],
  [22 * 60, 29 * 60],
];

export function hm(texto: string): number {
  const [h, m] = texto.split(":").map(Number);
  return h * 60 + m;
}

export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

function intervalo({ entrada, saida }: Par): [number, number] {
  return [entrada, saida <= entrada ? saida + 1440 : saida];
}

function duracao(par: Par): number {
  const [e, s] = intervalo(par);
  return s - e;
}

function minutosNoturnos(pares: Par[]): number {
  let real = 0;
  for (const par of pares) {
    const [e, s] = intervalo(par);
    for (const [ini, fim] of JANELAS_NOTURNAS)
      real += Math.max(0, Math.min(s, fim) - Math.max(e, ini));
  }
  return Math.round((real * 8) / 7);
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

// Percentual da hora extra do dia e se é data especial (feriado, domingo ou data fixa da convenção): data
// especial não vai para o banco nem conta no limite diário. Sábado e dia útil vão para os dois.
function faixaDoDia(dia: DiaDoCartao, semana: number, regras: RegrasDeCalculo) {
  const [, mes, d] = dia.data.split("-");
  const fixa = regras.datasEspeciais.find((e) => e.data === `${d}/${mes}`);
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
  const t: Totalizacao = { ...ZERO };
  const pagas = new Map<number, number>();
  let extrasDoDia = 0;
  let extrasLimitadas = 0;

  const somarExtra = (min: number) => {
    if (min <= 0) return;
    extrasDoDia += min;
    if (!especial) extrasLimitadas += min;
    if (!especial && regras.bancoDeHoras) t.bancoDeHorasMin += min;
    else pagas.set(percentual, (pagas.get(percentual) ?? 0) + min);
  };

  apurarDia(dia, jornada, regras, t, somarExtra, semana);

  t.extras = faixasOrdenadas(pagas);
  t.acimaDoLimiteMin = Math.max(0, extrasLimitadas - regras.limiteExtrasDiaMin);
  t.diasComLanche = extrasDoDia > 0 ? 1 : 0;
  const trabalhou = dia.extra !== null || dia.batidas.length > 0;
  t.sabadosTrabalhados = semana === 6 && !dia.feriado && trabalhou ? 1 : 0;
  return t;
}

function apurarDia(
  dia: DiaDoCartao,
  jornada: Jornada,
  regras: RegrasDeCalculo,
  t: Totalizacao,
  somarExtra: (min: number) => void,
  semana: number,
): void {
  const carga = jornada[semana];

  if (dia.extra) t.noturnoMin += minutosNoturnos([dia.extra]);
  somarExtra(dia.extra ? duracao(dia.extra) : 0);

  const trabalhado = dia.batidas.reduce((soma, p) => soma + duracao(p), 0);
  // Interruptor do Cliente: o domingo trabalhado é todo hora extra, tenha ou não Jornada.
  if (semana === 0 && regras.trabalhoAosDomingos && !dia.feriado) {
    if (trabalhado > 0) {
      somarExtra(trabalhado);
      t.noturnoMin += minutosNoturnos(dia.batidas);
    }
    return;
  }

  // Dia sem carga: só a coluna Extra conta.
  if (carga === 0 && !dia.feriado) return;

  if (dia.feriado) {
    // Feriado: sem falta; o que se trabalha é hora extra.
    if (trabalhado > 0) {
      somarExtra(trabalhado);
      t.feriadosTrabalhados = 1;
      t.noturnoMin += minutosNoturnos(dia.batidas);
    }
    return;
  }

  if (dia.batidas.length === 0) {
    if (dia.abono) {
      t.abonoDias = 1;
      t.abonoMin = carga;
    } else {
      t.faltas = 1;
    }
    return;
  }

  t.noturnoMin += minutosNoturnos(dia.batidas);
  const tolerancia = Math.min(TOLERANCIA_POR_MARCACAO * dia.batidas.length * 2, TOLERANCIA_POR_DIA);
  const diferenca = trabalhado - carga;
  if (Math.abs(diferenca) <= tolerancia) {
    t.normaisMin = carga;
  } else if (diferenca > 0) {
    t.normaisMin = carga;
    somarExtra(diferenca);
  } else {
    t.normaisMin = trabalhado;
    if (dia.abono) t.abonoMin = -diferenca;
    else t.atrasoMin = -diferenca;
  }
}

// `regrasDoDia` devolve as regras da data: a convenção vigente pode mudar no meio do período.
export function totalizar(
  dias: DiaDoCartao[],
  jornada: Jornada,
  regrasDoDia: (data: string) => RegrasDeCalculo = () => LEGISLACAO,
): Totalizacao {
  const soma: Totalizacao = { ...ZERO };
  const pagas = new Map<number, number>();
  for (const dia of dias) {
    const t = totalizarDia(dia, jornada, regrasDoDia(dia.data));
    for (const { percentual, minutos } of t.extras)
      pagas.set(percentual, (pagas.get(percentual) ?? 0) + minutos);
    for (const campo of Object.keys(soma) as (keyof Totalizacao)[]) {
      if (campo !== "extras") soma[campo] += t[campo];
    }
  }
  soma.extras = faixasOrdenadas(pagas);
  return soma;
}

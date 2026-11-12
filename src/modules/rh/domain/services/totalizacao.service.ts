// Totalização: a legislação padrão (CLT) com por cima os parâmetros da Convenção coletiva vigente na data do
// dia e os interruptores do Cliente (`RegrasDeCalculo`). Sem convenção, vale a legislação: hora extra de 50%
// em dia útil e de 100% em domingo e feriado, tolerância de 5 min por marcação e 10 por dia, adicional noturno
// das 22h às 5h com hora reduzida. Tudo em minutos; sem relógio. Valores em dinheiro ficam com o holerite: aqui
// saem minutos por faixa e contagens.
// Domingo com Jornada: as horas dentro da carga contam como normais e só o excedente é extra; o domingo
// inteiro virar extra é o interruptor "trabalho aos domingos" do Cliente.
// Não usados aqui: jornada e intervalos da convenção (a Jornada é do empregado), exceções de feriado (sem data
// para casar) e a data móvel da convenção sem a marca de feriado no cartão.
// Data fixa da convenção (ex.: 25/12) só decide o percentual da hora extra. Quem dispensa a carga e a falta e
// conta o feriado trabalhado é a marca de feriado do cartão, a única fonte: uma data especial da convenção
// nem sempre é feriado, e dispensar a falta por ela mudaria o pagamento sem o Responsável ter marcado o dia.

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

export function horaParaMinutos(texto: string): number {
  const [horas, minutos] = texto.split(":").map(Number);
  return horas * 60 + minutos;
}

export function diaDaSemana(data: string): number {
  const [ano, mes, diaDoMes] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, diaDoMes)).getUTCDay();
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

// A "H. Diária" do cartão: tudo o que foi batido no dia, nas duas batidas e na coluna Extra.
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

// Percentual da hora extra do dia e se é data especial (feriado, domingo ou data fixa da convenção): data
// especial não vai para o banco nem conta no limite diário. Sábado e dia útil vão para os dois.
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

// Apura o dia e devolve só o que ele sabe: as horas extras vão pelo `somarExtra`, e o resto
// (banco, faixas, limite, lanche, sábado) é montado por `totalizarDia`.
function apurarDia(
  { dia, jornada, regras, semana }: ContextoDoDia,
  somarExtra: (min: number) => void,
): Totalizacao {
  const carga = jornada[semana];
  const base: Totalizacao = {
    ...ZERO,
    noturnoMin: dia.extra ? minutosNoturnos([dia.extra]) : 0,
    // Feriado trabalhado só na coluna Extra (feriado e folga só têm a Extra liberada na tela) também conta.
    feriadosTrabalhados: dia.extra && dia.feriado ? 1 : 0,
  };
  somarExtra(dia.extra ? duracao(dia.extra) : 0);

  const trabalhado = dia.batidas.reduce((soma, p) => soma + duracao(p), 0);
  // Interruptor do Cliente: o domingo trabalhado é todo hora extra, tenha ou não Jornada.
  if (semana === 0 && regras.trabalhoAosDomingos && !dia.feriado) {
    return apurarDomingoTrabalhado(base, dia, trabalhado, somarExtra);
  }
  // Dia sem carga: só a coluna Extra conta.
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

// Feriado: sem falta; o que se trabalha é hora extra.
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

// `regrasDoDia` devolve as regras da data: a convenção vigente pode mudar no meio do período.
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

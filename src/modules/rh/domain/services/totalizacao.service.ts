// Totalização pela legislação padrão (CLT): hora extra de 50% em dia útil e de 100% em domingo e feriado,
// tolerância de 5 min por marcação e 10 por dia, adicional noturno das 22h às 5h com hora reduzida.
// Tudo em minutos; sem relógio, sem banco. Os parâmetros da Convenção coletiva entram no ticket do motor
// com a convenção; a marca "comissionado" também só vale lá (na legislação padrão a data especial é 100%).

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
  extras50Min: number;
  extras100Min: number;
  // Minutos já com a hora noturna reduzida (52min30s = 60min) dentro de 22h às 5h.
  noturnoMin: number;
  atrasoMin: number;
  faltas: number;
  abonoDias: number;
  abonoMin: number;
  feriadosTrabalhados: number;
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
  extras50Min: 0,
  extras100Min: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 0,
  abonoDias: 0,
  abonoMin: 0,
  feriadosTrabalhados: 0,
};

export function totalizarDia(dia: DiaDoCartao, jornada: Jornada): Totalizacao {
  const semana = diaDaSemana(dia.data);
  const carga = jornada[semana];
  const t: Totalizacao = { ...ZERO };
  const dataEspecial = dia.feriado || semana === 0;
  const extra = dia.extra ? duracao(dia.extra) : 0;
  const somarExtra = (min: number) => {
    if (dataEspecial) t.extras100Min += min;
    else t.extras50Min += min;
  };

  if (dia.extra) t.noturnoMin += minutosNoturnos([dia.extra]);
  somarExtra(extra);

  // Dia sem carga: só a coluna Extra conta.
  if (carga === 0 && !dia.feriado) return t;

  const trabalhado = dia.batidas.reduce((soma, p) => soma + duracao(p), 0);
  if (dia.feriado) {
    // Feriado: sem falta; o que se trabalha é hora extra de 100%.
    if (trabalhado > 0) {
      t.extras100Min += trabalhado;
      t.feriadosTrabalhados = 1;
      t.noturnoMin += minutosNoturnos(dia.batidas);
    }
    return t;
  }

  if (dia.batidas.length === 0) {
    if (dia.abono) {
      t.abonoDias = 1;
      t.abonoMin = carga;
    } else {
      t.faltas = 1;
    }
    return t;
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
  return t;
}

export function totalizar(dias: DiaDoCartao[], jornada: Jornada): Totalizacao {
  return dias.reduce<Totalizacao>((soma, dia) => {
    const t = totalizarDia(dia, jornada);
    return {
      normaisMin: soma.normaisMin + t.normaisMin,
      extras50Min: soma.extras50Min + t.extras50Min,
      extras100Min: soma.extras100Min + t.extras100Min,
      noturnoMin: soma.noturnoMin + t.noturnoMin,
      atrasoMin: soma.atrasoMin + t.atrasoMin,
      faltas: soma.faltas + t.faltas,
      abonoDias: soma.abonoDias + t.abonoDias,
      abonoMin: soma.abonoMin + t.abonoMin,
      feriadosTrabalhados: soma.feriadosTrabalhados + t.feriadosTrabalhados,
    };
  }, ZERO);
}

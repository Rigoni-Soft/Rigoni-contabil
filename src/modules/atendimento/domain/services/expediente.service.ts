import { FUSO_DE_NEGOCIO as FUSO } from "@/shared/kernel/mes-atual";

const HORA_DE_ABERTURA = 8;
const HORA_DE_FECHAMENTO = 18;
const DESLOCAMENTO_DE_SAO_PAULO = "-03:00";
const DOMINGO = 0;
const SABADO = 6;
const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const FERIADOS_FIXOS_MES_DIA = [
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
];

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function partesEmSp(instante: Date): { data: string; hora: number } {
  const p = Object.fromEntries(formatador.formatToParts(instante).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

function pascoaGregoriana(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const cacheNacionais = new Map<number, string[]>();

export function feriadosNacionais(ano: number): string[] {
  let datas = cacheNacionais.get(ano);
  if (!datas) {
    datas = calcularNacionais(ano);
    cacheNacionais.set(ano, datas);
  }
  return datas;
}

const DIAS_DA_PASCOA_ATE_CARNAVAL_SEGUNDA = -48;
const DIAS_DA_PASCOA_ATE_CARNAVAL_TERCA = -47;
const DIAS_DA_PASCOA_ATE_SEXTA_SANTA = -2;
const DIAS_DA_PASCOA_ATE_CORPUS_CHRISTI = 60;

function calcularNacionais(ano: number): string[] {
  const domingoDePascoa = pascoaGregoriana(ano);
  return [
    ...FERIADOS_FIXOS_MES_DIA.map((mesDia) => `${ano}-${mesDia}`),
    somarDias(domingoDePascoa, DIAS_DA_PASCOA_ATE_CARNAVAL_SEGUNDA),
    somarDias(domingoDePascoa, DIAS_DA_PASCOA_ATE_CARNAVAL_TERCA),
    somarDias(domingoDePascoa, DIAS_DA_PASCOA_ATE_SEXTA_SANTA),
    somarDias(domingoDePascoa, DIAS_DA_PASCOA_ATE_CORPUS_CHRISTI),
  ];
}

function diaUtil(data: string, extras: ReadonlySet<string>): boolean {
  const diaDaSemanaDaData = diaDaSemana(data);
  const fimDeSemana = diaDaSemanaDaData === DOMINGO || diaDaSemanaDaData === SABADO;
  if (fimDeSemana || extras.has(data)) return false;
  return !feriadosNacionais(Number(data.slice(0, 4))).includes(data);
}

export function estaAbertoEm(instante: Date, extras: ReadonlySet<string>): boolean {
  const { data, hora } = partesEmSp(instante);
  return diaUtil(data, extras) && hora >= HORA_DE_ABERTURA && hora < HORA_DE_FECHAMENTO;
}

export function proximaAbertura(instante: Date, extras: ReadonlySet<string>): string {
  const { data, hora } = partesEmSp(instante);
  let candidata = hora < HORA_DE_ABERTURA ? data : somarDias(data, 1);
  while (!diaUtil(candidata, extras)) candidata = somarDias(candidata, 1);
  return candidata;
}

export function avisoDeFechado(instante: Date, extras: ReadonlySet<string>): string {
  const { data: hoje } = partesEmSp(instante);
  const volta = proximaAbertura(instante, extras);
  return `Olá! No momento o escritório está fechado. Voltamos a atender ${quandoVoltamos(hoje, volta)}, às ${HORA_DE_ABERTURA}h.`;
}

function quandoVoltamos(hoje: string, volta: string): string {
  if (volta === hoje) return "hoje";
  if (volta === somarDias(hoje, 1)) return "amanhã";
  const [, mes, dia] = volta.split("-");
  return `${DIAS_SEMANA[diaDaSemana(volta)]}, ${dia}/${mes}`;
}

function horaDoDia(data: string, hora: number): number {
  return new Date(
    `${data}T${String(hora).padStart(2, "0")}:00:00${DESLOCAMENTO_DE_SAO_PAULO}`,
  ).getTime();
}

export function expedienteDecorrido(de: Date, ate: Date, extras: ReadonlySet<string>): number {
  const inicio = de.getTime();
  const fim = ate.getTime();
  let total = 0;
  const ultimo = partesEmSp(ate).data;
  for (let dia = partesEmSp(de).data; dia <= ultimo; dia = somarDias(dia, 1)) {
    if (!diaUtil(dia, extras)) continue;
    const abre = horaDoDia(dia, HORA_DE_ABERTURA);
    const fecha = horaDoDia(dia, HORA_DE_FECHAMENTO);
    total += Math.max(0, Math.min(fim, fecha) - Math.max(inicio, abre));
  }
  return total;
}

// Expediente da URA: aberto em dia útil (não sábado/domingo/feriado), das 8h às 18h, horário de
// São Paulo. As datas civis circulam como "AAAA-MM-DD"; os cálculos de calendário usam UTC só
// como aritmética de dias, sem relação com o fuso.
const FUSO = "America/Sao_Paulo";
const ABRE = 8;
const FECHA = 18;
const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
// Feriados nacionais de data fixa (mês-dia).
const FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

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

// Algoritmo anônimo gregoriano (Meeus/Jones/Butcher).
function pascoa(ano: number): string {
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

function calcularNacionais(ano: number): string[] {
  const p = pascoa(ano);
  return [
    ...FIXOS.map((md) => `${ano}-${md}`),
    somarDias(p, -48), // segunda de Carnaval
    somarDias(p, -47), // terça de Carnaval
    somarDias(p, -2), // Sexta-feira Santa
    somarDias(p, 60), // Corpus Christi
  ];
}

function diaUtil(data: string, extras: ReadonlySet<string>): boolean {
  const dow = diaDaSemana(data);
  if (dow === 0 || dow === 6 || extras.has(data)) return false;
  return !feriadosNacionais(Number(data.slice(0, 4))).includes(data);
}

export function estaAbertoEm(instante: Date, extras: ReadonlySet<string>): boolean {
  const { data, hora } = partesEmSp(instante);
  return diaUtil(data, extras) && hora >= ABRE && hora < FECHA;
}

// Data (dia útil) em que o escritório volta a atender às 8h: hoje, se ainda não abriu.
export function proximaAbertura(instante: Date, extras: ReadonlySet<string>): string {
  const { data, hora } = partesEmSp(instante);
  let candidata = hora < ABRE ? data : somarDias(data, 1);
  while (!diaUtil(candidata, extras)) candidata = somarDias(candidata, 1);
  return candidata;
}

export function avisoDeFechado(instante: Date, extras: ReadonlySet<string>): string {
  const { data: hoje } = partesEmSp(instante);
  const volta = proximaAbertura(instante, extras);
  let quando: string;
  if (volta === hoje) quando = "hoje";
  else if (volta === somarDias(hoje, 1)) quando = "amanhã";
  else {
    const [, mes, dia] = volta.split("-");
    quando = `${DIAS_SEMANA[diaDaSemana(volta)]}, ${dia}/${mes}`;
  }
  return `Olá! No momento o escritório está fechado. Voltamos a atender ${quando}, às ${ABRE}h.`;
}

// Tempo (ms) de expediente aberto entre dois instantes: a noite, o fim de semana e os feriados não
// contam. ponytail: offset fixo -03:00 (o Brasil não tem horário de verão desde 2019); se voltar,
// derivar o instante de abertura do FUSO.
export function expedienteDecorrido(de: Date, ate: Date, extras: ReadonlySet<string>): number {
  const inicio = de.getTime();
  const fim = ate.getTime();
  const hora = (h: number) => String(h).padStart(2, "0");
  let total = 0;
  const ultimo = partesEmSp(ate).data;
  for (let dia = partesEmSp(de).data; dia <= ultimo; dia = somarDias(dia, 1)) {
    if (!diaUtil(dia, extras)) continue;
    const abre = new Date(`${dia}T${hora(ABRE)}:00:00-03:00`).getTime();
    const fecha = new Date(`${dia}T${hora(FECHA)}:00:00-03:00`).getTime();
    total += Math.max(0, Math.min(fim, fecha) - Math.max(inicio, abre));
  }
  return total;
}

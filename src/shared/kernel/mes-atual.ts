export const FUSO_DE_NEGOCIO = "America/Sao_Paulo";

const FORMATO_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DE_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hojeIso(agora: Date = new Date()): string {
  return FORMATO_DATA.format(agora);
}

export function diaDoMes(agora: Date = new Date()): number {
  return Number(hojeIso(agora).slice(8));
}

export function mesAtual(agora: Date = new Date()): string {
  return hojeIso(agora).slice(0, 7);
}

export function ultimoDiaDoMes(agora: Date = new Date()): number {
  const [ano, mes] = mesAtual(agora).split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function primeiroDiaDoMesAtual(agora: Date = new Date()): string {
  return `${mesAtual(agora)}-01`;
}

export function mesAnterior(agora: Date = new Date()): string {
  const [ano, mes] = mesAtual(agora).split("-").map(Number);
  return mes === 1 ? `${ano - 1}12` : `${ano}${String(mes - 1).padStart(2, "0")}`;
}

export function mesVizinho(competencia: string, delta: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

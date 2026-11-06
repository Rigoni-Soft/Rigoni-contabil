// Fuso de negócio do escritório: todo "hoje", mês e horário exibido usa este.
export const FUSO_DE_NEGOCIO = "America/Sao_Paulo";

const FORMATO_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DE_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Hoje no fuso de negócio, "AAAA-MM-DD".
export function hojeIso(agora: Date = new Date()): string {
  return FORMATO_DATA.format(agora);
}

// Dia do mês (1-31) no fuso de negócio.
export function diaDoMes(agora: Date = new Date()): number {
  return Number(hojeIso(agora).slice(8));
}

// Mês corrente no fuso de negócio (America/Sao_Paulo), "YYYY-MM". UTC erraria
// o mês entre 21h e 23h59 do último dia (Brasília), quando UTC já virou.
export function mesAtual(agora: Date = new Date()): string {
  return hojeIso(agora).slice(0, 7);
}

// Último dia (28-31) do mês corrente no fuso de negócio.
export function ultimoDiaDoMes(agora: Date = new Date()): number {
  const [ano, mes] = mesAtual(agora).split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function primeiroDiaDoMesAtual(agora: Date = new Date()): string {
  return `${mesAtual(agora)}-01`;
}

// Mês anterior ao corrente no fuso de negócio, "AAAAMM" (formato do provedor).
export function mesAnterior(agora: Date = new Date()): string {
  const [ano, mes] = mesAtual(agora).split("-").map(Number);
  return mes === 1 ? `${ano - 1}12` : `${ano}${String(mes - 1).padStart(2, "0")}`;
}

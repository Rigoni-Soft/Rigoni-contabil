const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

const FORMATO_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
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
  return FORMATO.format(agora);
}

export function primeiroDiaDoMesAtual(agora: Date = new Date()): string {
  return `${mesAtual(agora)}-01`;
}

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

// Mês corrente no fuso de negócio (America/Sao_Paulo), "YYYY-MM". UTC erraria
// o mês entre 21h e 23h59 do último dia (Brasília), quando UTC já virou.
export function mesAtual(agora: Date = new Date()): string {
  return FORMATO.format(agora);
}

export function primeiroDiaDoMesAtual(agora: Date = new Date()): string {
  return `${mesAtual(agora)}-01`;
}

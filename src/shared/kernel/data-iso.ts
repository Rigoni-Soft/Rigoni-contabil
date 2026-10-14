// "AAAA-MM-DD" → "DD/MM/AAAA".
export function formatarDataIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "AAAA-MM" → "MM/AAAA".
export function formatarCompetencia(anoMes: string): string {
  const [ano, mes] = anoMes.split("-");
  return `${mes}/${ano}`;
}

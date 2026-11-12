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

// "AAAAMM" (parcela do provedor fiscal) → "MM/AAAA".
export function formatarParcela(aaaamm: string): string {
  return `${aaaamm.slice(4)}/${aaaamm.slice(0, 4)}`;
}

// "AAAA-MM-DD" que existe no calendário (recusa 2026-02-31).
export function dataIsoValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const real = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    real.getUTCFullYear() === ano && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia
  );
}

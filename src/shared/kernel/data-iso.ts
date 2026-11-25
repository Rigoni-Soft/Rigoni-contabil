export const FORMATO_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export const FORMATO_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function formatarDataIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarCompetencia(anoMes: string): string {
  const [ano, mes] = anoMes.split("-");
  return `${mes}/${ano}`;
}

export function formatarParcela(aaaamm: string): string {
  return `${aaaamm.slice(4)}/${aaaamm.slice(0, 4)}`;
}

export function dataIsoValida(data: string): boolean {
  if (!FORMATO_DATA_ISO.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const real = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    real.getUTCFullYear() === ano && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia
  );
}

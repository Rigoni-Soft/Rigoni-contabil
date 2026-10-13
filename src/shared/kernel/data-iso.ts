// "AAAA-MM-DD" → "DD/MM/AAAA".
export function formatarDataIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

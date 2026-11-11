export type Quinzena = 1 | 2;

// Os dias ("AAAA-MM-DD") da quinzena de uma competência "AAAA-MM": 1 = dias 1 a 15; 2 = dia 16 ao último.
export function diasDaQuinzena(competencia: string, quinzena: Quinzena): string[] {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const [de, ate] = quinzena === 1 ? [1, 15] : [16, ultimo];
  return Array.from(
    { length: ate - de + 1 },
    (_, i) => `${competencia}-${String(de + i).padStart(2, "0")}`,
  );
}

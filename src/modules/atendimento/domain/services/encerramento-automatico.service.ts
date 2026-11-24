export const URA_ATOR_ID = "00000000-0000-0000-0000-000000000000";

const PRAZO_MS = (23 * 60 + 50) * 60_000;

export function corteDoEncerramento(agora: Date): Date {
  return new Date(agora.getTime() - PRAZO_MS);
}

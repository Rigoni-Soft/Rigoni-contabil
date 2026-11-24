export const URA_ATOR_ID = "00000000-0000-0000-0000-000000000000";

const MS_POR_MINUTO = 60_000;
const PRAZO_DO_ENCERRAMENTO_EM_MS = (23 * 60 + 50) * MS_POR_MINUTO;

export function corteDoEncerramento(agora: Date): Date {
  return new Date(agora.getTime() - PRAZO_DO_ENCERRAMENTO_EM_MS);
}

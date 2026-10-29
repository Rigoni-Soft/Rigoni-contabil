// Ator de sistema da URA na auditoria (a tabela não exige um perfil para o ator).
export const URA_ATOR_ID = "00000000-0000-0000-0000-000000000000";

const MINUTO = 60_000;
export const PRAZO_SEM_RESPOSTA_MS = (23 * 60 + 50) * MINUTO;

// Relógio corrido, sem expediente: o Atendimento cuja última Mensagem do cliente é deste instante
// (ou anterior) já passou de 23h50 e se encerra.
export function corteDoEncerramento(agora: Date): Date {
  return new Date(agora.getTime() - PRAZO_SEM_RESPOSTA_MS);
}

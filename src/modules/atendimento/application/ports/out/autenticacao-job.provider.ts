// Prova de que quem chamou o job é o agendador: o segredo fica na infra, nunca no handler.
export interface AutenticacaoJobPort {
  autorizado(authorization: string | null): boolean;
}

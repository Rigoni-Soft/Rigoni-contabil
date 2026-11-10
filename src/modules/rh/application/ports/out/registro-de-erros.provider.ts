// Registro técnico de falhas não fatais. Passe só a mensagem do erro, nunca o objeto inteiro.
export interface RegistroDeErrosPort {
  registrar(mensagem: string, ...detalhes: unknown[]): void;
}

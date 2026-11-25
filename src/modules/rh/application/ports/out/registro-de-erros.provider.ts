export interface RegistroDeErrosPort {
  registrar(mensagem: string, ...detalhes: unknown[]): void;
}

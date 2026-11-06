// Registro técnico de falhas não fatais (o operador lê no log do servidor). Passe só a mensagem do
// erro, nunca o objeto inteiro: pode carregar CNPJ ou outro dado pessoal.
export interface RegistroDeErrosPort {
  registrar(mensagem: string, ...detalhes: unknown[]): void;
}

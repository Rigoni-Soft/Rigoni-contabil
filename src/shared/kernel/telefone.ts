// O telefone do Contato é DDD + número (10 ou 11 dígitos); o DDI 55 é descartado.
export function telefoneTemDdd(telefone: string): boolean {
  const digitos = telefone.replace(/\D/g, "");
  const nacional = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return nacional.length === 10 || nacional.length === 11;
}

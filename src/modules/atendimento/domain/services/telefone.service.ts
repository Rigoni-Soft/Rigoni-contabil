// DDI 55 é descartado: o telefone do Contato é cadastrado só com DDD + número.
export function soDigitosNacionais(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

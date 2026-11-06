// Celular nacional sem o 9º dígito: DDD + 8 dígitos começando em 6-9 (fixo começa em 2-5).
const CELULAR_SEM_NONO = /^(\d{2})([6-9]\d{7})$/;

// DDI 55 é descartado: o telefone do Contato é cadastrado só com DDD + número, com o 9º dígito.
// O WhatsApp pode entregar o celular sem ele; devolvemos o 9 pra a chave bater com o cadastro.
export function soDigitosNacionais(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const nacional = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return nacional.replace(CELULAR_SEM_NONO, "$19$2");
}

// O sistema guarda e mostra o 9º dígito; o WhatsApp o recebe sem ele (só no envio).
// ponytail: só celular com DDI (55 + DDD + 9 + 8 dígitos); qualquer outro formato segue como veio.
export function semNonoDigito(telefoneComDdi: string): string {
  return telefoneComDdi.replace(/^(55\d{2})9(\d{8})$/, "$1$2");
}

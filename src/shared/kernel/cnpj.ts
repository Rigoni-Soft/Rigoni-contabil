const PESOS_PRIMEIRO_DV = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DV = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizarCnpj(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const CODIGO_ASCII_DO_ZERO = 48;
const MODULO_DO_DIGITO = 11;
const CNPJ_COM_UM_SO_CARACTERE = /^(.)\1{13}$/;
const FORMATO_DO_CNPJ = /^[0-9A-Z]{12}\d{2}$/;

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = [...base].reduce(
    (acumulado, caractere, indice) =>
      acumulado + (caractere.charCodeAt(0) - CODIGO_ASCII_DO_ZERO) * pesos[indice],
    0,
  );
  const resto = soma % MODULO_DO_DIGITO;
  return resto < 2 ? 0 : MODULO_DO_DIGITO - resto;
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = normalizarCnpj(entrada);
  if (!FORMATO_DO_CNPJ.test(cnpj) || CNPJ_COM_UM_SO_CARACTERE.test(cnpj)) return false;

  const raiz = cnpj.slice(0, 12);
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DV);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DV);
  return cnpj.slice(12) === `${d1}${d2}`;
}

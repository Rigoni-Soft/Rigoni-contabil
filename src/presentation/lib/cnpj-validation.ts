// Mesmo algoritmo mod-11 do domain (Cnpj.criar, cnpj.vo.ts) — duplicado de
// propósito: view-models não podem importar domain (arquitetura.md, regra
// "viewmodel-sem-domain-nem-infra"). Isto só dá feedback cedo na interface;
// a validação que vale de verdade continua no domain, do lado do servidor.
const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

export function cnpjValido(entrada: string): boolean {
  const digitos = entrada.replace(/\D/g, "");
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const raiz = digitos.slice(0, 12);
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return digitos === raiz + d1 + d2;
}

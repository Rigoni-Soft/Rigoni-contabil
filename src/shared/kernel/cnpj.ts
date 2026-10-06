// Fonte única de normalização e validação de CNPJ (domain e presentation usam
// esta). Aceita o formato numérico legado e o alfanumérico vigente desde jul/2026
// (Receita Federal): 12 primeiras posições [0-9A-Z] + 2 dígitos verificadores
// numéricos. Cada caractere vale seu código ASCII − 48 (0-9 → 0-9, A → 17...);
// pesos e módulo 11 são os mesmos do CNPJ numérico, que por isso continua válido.
const PESOS_PRIMEIRO_DV = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DV = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// Forma canônica: sem pontuação e em maiúsculas (letras minúsculas digitadas
// valem as maiúsculas). Nunca descarta letras.
export function normalizarCnpj(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = [...base].reduce(
    (acumulado, caractere, indice) => acumulado + (caractere.charCodeAt(0) - 48) * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = normalizarCnpj(entrada);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;

  const raiz = cnpj.slice(0, 12);
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DV);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DV);
  return cnpj.slice(12) === `${d1}${d2}`;
}

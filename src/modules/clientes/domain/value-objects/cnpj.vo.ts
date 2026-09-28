import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

// Algoritmo padrão (mod 11) da Receita Federal, ainda válido para o CNPJ
// alfanumérico (Nota Técnica 2025.001): os dígitos verificadores continuam
// numéricos, calculados sobre os 12 primeiros caracteres.
function valido(digitos: string): boolean {
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const raiz = digitos.slice(0, 12);
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return digitos === raiz + d1 + d2;
}

export class Cnpj {
  private constructor(private readonly props: { digitos: string }) {}

  static criar(entrada: string): Result<Cnpj, ValidationError> {
    const digitos = entrada.replace(/\D/g, "");
    if (!valido(digitos)) return err(new ValidationError(`CNPJ inválido: ${entrada}`));
    return ok(new Cnpj({ digitos }));
  }

  get digitos(): string {
    return this.props.digitos;
  }
}

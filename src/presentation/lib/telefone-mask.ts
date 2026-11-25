import { soDigitosNacionais } from "@/shared/kernel/telefone";

export function formatarTelefone(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";

  let resultado = `(${digitos.slice(0, 2)}`;
  if (digitos.length <= 2) return resultado;
  resultado += `) `;

  const restante = digitos.slice(2);
  const digitosAntesDoHifen = digitos.length > 10 ? 5 : 4;
  resultado += restante.slice(0, digitosAntesDoHifen);
  if (restante.length > digitosAntesDoHifen) {
    resultado += `-${restante.slice(digitosAntesDoHifen)}`;
  }
  return resultado;
}

export function telefoneParaExibicao(telefone: string): string {
  return formatarTelefone(soDigitosNacionais(telefone));
}

import { normalizarCnpj } from "@/shared/kernel/cnpj";

export function formatarCnpj(entrada: string): string {
  const caracteres = normalizarCnpj(entrada).slice(0, 14);

  let resultado = caracteres.slice(0, 2);
  if (caracteres.length > 2) resultado += `.${caracteres.slice(2, 5)}`;
  if (caracteres.length > 5) resultado += `.${caracteres.slice(5, 8)}`;
  if (caracteres.length > 8) resultado += `/${caracteres.slice(8, 12)}`;
  if (caracteres.length > 12) resultado += `-${caracteres.slice(12, 14)}`;
  return resultado;
}

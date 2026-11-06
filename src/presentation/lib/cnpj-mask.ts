import { normalizarCnpj } from "@/shared/kernel/cnpj";

// Máscara de exibição (00.000.000/0000-00) — puramente visual, aplicada
// progressivamente enquanto o usuário digita. Preserva letras (CNPJ
// alfanumérico); quem valida é `cnpjValido` (shared/kernel) e o domain.
export function formatarCnpj(entrada: string): string {
  const caracteres = normalizarCnpj(entrada).slice(0, 14);

  let resultado = caracteres.slice(0, 2);
  if (caracteres.length > 2) resultado += `.${caracteres.slice(2, 5)}`;
  if (caracteres.length > 5) resultado += `.${caracteres.slice(5, 8)}`;
  if (caracteres.length > 8) resultado += `/${caracteres.slice(8, 12)}`;
  if (caracteres.length > 12) resultado += `-${caracteres.slice(12, 14)}`;
  return resultado;
}

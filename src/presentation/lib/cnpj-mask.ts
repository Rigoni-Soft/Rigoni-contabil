// Máscara de exibição (00.000.000/0000-00) — puramente visual, aplicada
// progressivamente enquanto o usuário digita. A validação de dígito
// verificador continua no domain (Cnpj.criar, que já ignora não-dígitos).
export function formatarCnpj(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "").slice(0, 14);

  let resultado = digitos.slice(0, 2);
  if (digitos.length > 2) resultado += `.${digitos.slice(2, 5)}`;
  if (digitos.length > 5) resultado += `.${digitos.slice(5, 8)}`;
  if (digitos.length > 8) resultado += `/${digitos.slice(8, 12)}`;
  if (digitos.length > 12) resultado += `-${digitos.slice(12, 14)}`;
  return resultado;
}

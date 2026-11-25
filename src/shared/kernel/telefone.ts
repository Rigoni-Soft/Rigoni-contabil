export const soDigitos = (telefone: string) => telefone.replace(/\D/g, "");

export function soDigitosNacionais(telefone: string): string {
  const digitos = soDigitos(telefone);
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

export const chaveDoTelefone = (telefone: string): string | null =>
  soDigitosNacionais(telefone) || null;

export function telefoneTemDdd(telefone: string): boolean {
  const tamanho = chaveDoTelefone(telefone)?.length;
  return tamanho === 10 || tamanho === 11;
}

export function telefoneAceito(telefone: string, original?: string): boolean {
  if (original !== undefined && soDigitos(telefone) === soDigitos(original)) return true;
  return telefoneTemDdd(telefone);
}

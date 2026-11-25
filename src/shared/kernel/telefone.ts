export const soDigitos = (telefone: string) => telefone.replace(/\D/g, "");

const CELULAR_SEM_NONO_DIGITO = /^(\d{2})([6-9]\d{7})$/;
const CELULAR_COM_DDI_E_NONO_DIGITO = /^(55\d{2})9(\d{8})$/;

export function soDigitosNacionais(telefone: string): string {
  const digitos = soDigitos(telefone);
  const nacional = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return nacional.replace(CELULAR_SEM_NONO_DIGITO, "$19$2");
}

export const semNonoDigito = (telefoneComDdi: string): string =>
  telefoneComDdi.replace(CELULAR_COM_DDI_E_NONO_DIGITO, "$1$2");

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

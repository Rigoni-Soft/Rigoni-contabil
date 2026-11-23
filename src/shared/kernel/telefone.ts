export const soDigitos = (telefone: string) => telefone.replace(/\D/g, "");

// Só dígitos e sem o DDI 55: o telefone do Contato é cadastrado só com DDD + número. A mesma regra do banco
// (`chave_telefone`); a regra mora aqui, num lugar só.
export function soDigitosNacionais(telefone: string): string {
  const digitos = soDigitos(telefone);
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

// A chave do número: dois contatos com a mesma chave são o mesmo número; null = sem número.
export const chaveDoTelefone = (telefone: string): string | null =>
  soDigitosNacionais(telefone) || null;

// O telefone do Contato é DDD + número (10 ou 11 dígitos); o DDI 55 é descartado.
export function telefoneTemDdd(telefone: string): boolean {
  const tamanho = chaveDoTelefone(telefone)?.length;
  return tamanho === 10 || tamanho === 11;
}

// O DDD só é cobrado do número novo ou trocado: o que já estava gravado (`original`) passa como veio,
// a mesma regra do banco (`contato_validar`), para o contato de outro Setor não travar o Salvar.
export function telefoneAceito(telefone: string, original?: string): boolean {
  if (original !== undefined && soDigitos(telefone) === soDigitos(original)) return true;
  return telefoneTemDdd(telefone);
}

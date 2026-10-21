// Regra do nº da alteração contratual: obrigatório, inteiro > 0 e único por Cliente. Pura, para
// valer igual na criação do Cliente (form, schema, domínio) e no anexar posterior.

export const NUMERO_MAXIMO = 999_999_999;
export const ERRO_NUMERO_INVALIDO = `Informe um nº inteiro de 1 a ${NUMERO_MAXIMO}`;

// Prefixo numérico do nome do arquivo ("2-alteracao.pdf" → 2). Limitado a 9 dígitos: acima disso
// deixa de ser um nº de alteração e estoura o inteiro do banco.
export function numeroDoNomeDoArquivo(nome: string): number | null {
  const numero = Number(/^(\d{1,9})\D/.exec(nome)?.[1]);
  return numero > 0 ? numero : null;
}

export function sugerirNumero(nomeDoArquivo: string, numerosExistentes: number[]): number {
  return numeroDoNomeDoArquivo(nomeDoArquivo) ?? Math.max(0, ...numerosExistentes) + 1;
}

export function erroDeFormato(numero: number): string | null {
  const valido = Number.isInteger(numero) && numero > 0 && numero <= NUMERO_MAXIMO;
  return valido ? null : ERRO_NUMERO_INVALIDO;
}

export function erroDeDuplicidade(numero: number, outrosNumeros: number[]): string | null {
  return outrosNumeros.includes(numero) ? `Já existe a alteração nº ${numero}` : null;
}

type NumeroEData = { numero: number; data: string };

// Alerta (não bloqueia): maior nº menor que o desta alteração cuja data é posterior à dela.
export function divergenciaNumeroData(atual: NumeroEData, outras: NumeroEData[]): number | null {
  const anteriores = outras.filter((o) => o.numero < atual.numero && o.data > atual.data);
  return anteriores.length > 0 ? Math.max(...anteriores.map((o) => o.numero)) : null;
}

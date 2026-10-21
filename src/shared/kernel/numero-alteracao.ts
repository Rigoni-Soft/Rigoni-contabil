// Regra do nº da alteração contratual: obrigatório, inteiro > 0 e único por Cliente. Pura, para
// valer igual no formulário, no schema e no domínio.

export const NUMERO_MAXIMO = 999_999_999;
// Texto de ajuda do campo de nº (criação do Cliente e anexar alteração dizem a mesma coisa).
export const AJUDA_NUMERO_ALTERACAO =
  "Sugerido pelo início do nome do arquivo (ex.: 2-alteracao.pdf) ou o próximo da sequência. Pode editar.";
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

// Nºs das demais alterações da lista (a de índice `indice` fica de fora).
export function outrosNumeros(alteracoes: { numero: number }[], indice: number): number[] {
  return alteracoes.filter((_, i) => i !== indice).map((alteracao) => alteracao.numero);
}

// Nº já usado por outra alteração do mesmo Cliente (formulário, tela e banco dizem a mesma frase).
export function erroNumeroRepetidoNoCliente(numero: number): string {
  return `Já existe a alteração nº ${numero} deste Cliente.`;
}

export function erroDeDuplicidade(numero: number, outrosNumeros: number[]): string | null {
  return outrosNumeros.includes(numero) ? erroNumeroRepetidoNoCliente(numero) : null;
}

type AlteracaoNumerada = { numero: number; data: string };

// Alerta (não bloqueia): maior nº menor que o desta alteração cuja data é posterior à dela.
export function divergenciaNumeroData(
  atual: AlteracaoNumerada,
  outras: AlteracaoNumerada[],
): number | null {
  const anteriores = outras.filter(
    (outra) => outra.numero < atual.numero && outra.data > atual.data,
  );
  return anteriores.length > 0 ? Math.max(...anteriores.map((outra) => outra.numero)) : null;
}

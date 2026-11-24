export const NUMERO_MAXIMO = 999_999_999;
export const AJUDA_NUMERO_ALTERACAO =
  "Sugerido pelo início do nome do arquivo (ex.: 2-alteracao.pdf) ou o próximo da sequência. Pode editar.";
export const ERRO_NUMERO_INVALIDO = `Informe um nº inteiro de 1 a ${NUMERO_MAXIMO}`;

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

export function outrosNumeros(alteracoes: { numero: number }[], indice: number): number[] {
  return alteracoes.filter((_, i) => i !== indice).map((alteracao) => alteracao.numero);
}

export function erroNumeroRepetidoNoCliente(numero: number): string {
  return `Já existe a alteração nº ${numero} deste Cliente.`;
}

export function erroDeDuplicidade(numero: number, outrosNumeros: number[]): string | null {
  return outrosNumeros.includes(numero) ? erroNumeroRepetidoNoCliente(numero) : null;
}

type AlteracaoNumerada = { numero: number; data: string };

export function divergenciaNumeroData(
  atual: AlteracaoNumerada,
  outras: AlteracaoNumerada[],
): number | null {
  const anteriores = outras.filter(
    (outra) => outra.numero < atual.numero && outra.data > atual.data,
  );
  return anteriores.length > 0 ? Math.max(...anteriores.map((outra) => outra.numero)) : null;
}

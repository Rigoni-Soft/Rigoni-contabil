export function opcaoUnica<T>(opcoes: readonly T[]): T | undefined {
  return opcoes.length === 1 ? opcoes[0] : undefined;
}

export function opcoesDe<T extends string>(valores: readonly T[], rotulos: Record<T, string>) {
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
}

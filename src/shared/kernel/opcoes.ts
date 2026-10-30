// Regra de "opção única trava o campo" (Papel/Setor no cadastro de Líder/Funcionário), usada pelo
// container (módulo usuarios) e pelo form (presentation/ global), que não podem se importar
// entre si (arquitetura.md §3.4): extraída aqui, como papeis.ts, pra não divergir.
export function opcaoUnica<T>(opcoes: readonly T[]): T | undefined {
  return opcoes.length === 1 ? opcoes[0] : undefined;
}

// {valor, rótulo} de um enum de domínio, pro Select/lista de opções (uma só forma de montar).
export function opcoesDe<T extends string>(valores: readonly T[], rotulos: Record<T, string>) {
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
}

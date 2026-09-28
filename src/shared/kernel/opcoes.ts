// Regra de "opção única trava o campo" (Papel/Setor no cadastro de
// Líder/Funcionário, #32) calculada em 2 pontos que não podem se importar
// entre si (container, dentro do módulo usuarios, e o form, em
// presentation/ global — arquitetura.md §3.4): extraído aqui pelo mesmo
// motivo de papeis.ts, pra não divergir a mesma regra em 2 lugares.
export function opcaoUnica<T>(opcoes: readonly T[]): T | undefined {
  return opcoes.length === 1 ? opcoes[0] : undefined;
}

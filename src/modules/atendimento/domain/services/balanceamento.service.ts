// Quantas vezes se relista e escolhe de novo quando o Funcionário escolhido é ocupado no meio.
export const TENTATIVAS_DE_ATRIBUICAO = 3;

type Candidato = { id: string; atendimentosNoMes: number; livre: boolean };

// Menos Atendimentos no mês primeiro; empate fica com a ordem devolvida (estável).
export function menosCarregado<T extends Candidato>(funcionarios: T[]): T | null {
  return funcionarios
    .filter((f) => f.livre)
    .reduce<T | null>(
      (melhor, f) => (!melhor || f.atendimentosNoMes < melhor.atendimentosNoMes ? f : melhor),
      null,
    );
}

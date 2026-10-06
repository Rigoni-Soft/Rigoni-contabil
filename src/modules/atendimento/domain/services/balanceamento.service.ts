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

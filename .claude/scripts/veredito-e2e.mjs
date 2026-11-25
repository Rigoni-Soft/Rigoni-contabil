// Decide a saída do check:e2e-local a partir do relatório JSON do Playwright. Função pura, testada em scripts/checar-e2e-local.spec.ts.
// Política de skips: o repositório não declara test.skip/fixme, então todo teste que não rodou eliminou cobertura do diff.
// Verde exige ao menos um teste executado e aprovado e nenhum skipped; skipped sem vermelho real é cobertura parcial (2).
export const SAIDA_VERDE = 0;
export const SAIDA_FALHA = 1;
export const SAIDA_COBERTURA_PARCIAL = 2;

/**
 * @param {{ statusPlaywright: number, errosGlobais: unknown[], stats: { expected?: number, skipped?: number }, vermelhos: number, reais: number }} entrada
 * @returns {{ codigo: number, motivo: string }}
 */
export function veredito({ statusPlaywright, errosGlobais, stats, vermelhos, reais }) {
  const expected = stats?.expected ?? 0;
  const skipped = stats?.skipped ?? 0;

  if (statusPlaywright === 0 && errosGlobais.length === 0 && vermelhos === 0) {
    if (expected === 0) {
      return {
        codigo: SAIDA_FALHA,
        motivo: `nenhum teste foi executado e aprovado (${skipped} não rodaram); a cobertura do diff é zero.`,
      };
    }
    if (skipped > 0) {
      return {
        codigo: SAIDA_COBERTURA_PARCIAL,
        motivo: `cobertura parcial: ${skipped} teste(s) do diff não rodaram (skipped); ${expected} passaram.`,
      };
    }
    return { codigo: SAIDA_VERDE, motivo: `e2e do diff verde (${expected} testes passaram).` };
  }

  if (errosGlobais.length === 0 && vermelhos > 0 && reais === 0) {
    return {
      codigo: SAIDA_COBERTURA_PARCIAL,
      motivo: `cobertura parcial: ${vermelhos} teste(s) bloqueado(s) pelo Storage local não foram verificados (${skipped} não rodaram).`,
    };
  }
  return {
    codigo: SAIDA_FALHA,
    motivo: `e2e do diff NÃO verde: Playwright saiu com ${statusPlaywright}, ${reais} vermelho(s) fora do Storage, ${errosGlobais.length} erro(s) global(is), ${skipped} não rodaram.`,
  };
}

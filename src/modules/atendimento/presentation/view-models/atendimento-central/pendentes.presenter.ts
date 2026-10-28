// O que pede a atenção de quem atende: quem espera o Setor e as conversas em que o cliente escreveu
// por último. Alimenta o contador do menu e o da aba "Em atendimento".
export function totalDePendentes(espera: number, conversas: { aguardando: boolean }[]): number {
  return espera + conversas.filter((c) => c.aguardando).length;
}

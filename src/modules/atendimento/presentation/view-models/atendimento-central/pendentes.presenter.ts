type ComCliente = { aguardando: boolean };

// As conversas em que o cliente escreveu por último: o contador da aba "Em atendimento".
export function contarAguardando(conversas: ComCliente[]): number {
  return conversas.filter((c) => c.aguardando).length;
}

// O que pede a atenção de quem atende: quem espera o Setor mais as conversas com cliente
// aguardando. É o contador do menu.
export function totalDePendentes(espera: number, conversas: ComCliente[]): number {
  return espera + contarAguardando(conversas);
}

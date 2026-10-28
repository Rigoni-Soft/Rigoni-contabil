// As conversas em que o cliente escreveu por último: o contador da aba "Em atendimento" e parte do
// contador do menu.
export function contarAguardando(conversas: { aguardando: boolean }[]): number {
  return conversas.filter((c) => c.aguardando).length;
}

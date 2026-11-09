type Card = { id: string };
type Grupo = { titulo: string; cardIds: string[] };
type Extra<C extends Card> = { cards: C[]; grupo: Grupo };

// O dashboard do RH é o do SN com os dados do RH: o Parcelamento vem do módulo clientes; o acompanhamento
// do mês vem do módulo rh e abre a tela, antes do Parcelamento. Se a leitura do acompanhamento falhou
// (undefined), o dashboard segue só com o que há.
export function juntarResumoRh<R extends { cards: Card[]; grupos: Grupo[] }, E extends Card>(
  resumo: R,
  doMes: Extra<E> | undefined,
): Omit<R, "cards"> & { cards: (R["cards"][number] | E)[] } {
  return {
    ...resumo,
    cards: [...resumo.cards, ...(doMes?.cards ?? [])],
    grupos: [...(doMes ? [doMes.grupo] : []), ...resumo.grupos],
  };
}

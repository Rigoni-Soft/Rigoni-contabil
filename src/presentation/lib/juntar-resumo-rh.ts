type Card = { id: string };
type Grupo = { titulo: string; cardIds: string[] };
type Extra<C extends Card> = { cards: C[]; grupo: Grupo };

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

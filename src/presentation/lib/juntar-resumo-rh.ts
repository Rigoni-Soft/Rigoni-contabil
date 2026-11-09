type Card = { id: string };
type Grupo = { titulo: string; cardIds: string[] };
type Extra<C extends Card> = { cards: C[]; grupo: Grupo };

// O dashboard do RH é o do SN com os dados do RH: a carteira e o Parcelamento vêm do módulo clientes; o
// acompanhamento do mês e o dos funcionários vêm do módulo rh. Os grupos se juntam na ordem da tela:
// carteira, acompanhamento, funcionários e o resto (Parcelamento). Um grupo ausente (o ator não o vê ou a
// leitura falhou) é pulado, e o dashboard segue com o que há.
export function juntarResumoRh<R extends { cards: Card[]; grupos: Grupo[] }, E extends Card>(
  resumo: R,
  ...grupos: (Extra<E> | undefined)[]
): Omit<R, "cards"> & { cards: (R["cards"][number] | E)[] } {
  const [carteira, ...demais] = resumo.grupos;
  const extras = grupos.filter((g) => g !== undefined);
  return {
    ...resumo,
    cards: [...resumo.cards, ...extras.flatMap((e) => e.cards)],
    grupos: [carteira, ...extras.map((e) => e.grupo), ...demais],
  };
}

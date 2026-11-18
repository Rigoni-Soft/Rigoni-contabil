// Paginação das listas numeradas da URA (alterações, setores): a regra vive aqui, cada lista só
// escolhe o tamanho da página e monta o texto dos itens.
export type Pagina<T> = {
  total: number;
  pagina: number;
  itens: T[];
  temMais: boolean;
  // O item do número digitado na página (a numeração recomeça em 1 a cada página). Só vale
  // inteiro sem zero à esquerda: "01" e "007" não são o número impresso na lista.
  escolher: (texto: string) => T | undefined;
};

// `pagina` fora do intervalo (lista que encolheu desde que foi exibida) vira a mais próxima válida.
export function paginar<T>(itens: T[], pagina: number, porPagina: number): Pagina<T> {
  const total = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(pagina, 1), total);
  const daPagina = itens.slice((atual - 1) * porPagina, atual * porPagina);
  return {
    total,
    pagina: atual,
    itens: daPagina,
    temMais: atual < total,
    escolher: (texto) => (/^[1-9]\d*$/.test(texto) ? daPagina[Number(texto) - 1] : undefined),
  };
}

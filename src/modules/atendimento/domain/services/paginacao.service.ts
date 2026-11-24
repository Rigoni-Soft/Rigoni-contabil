export type Pagina<T> = {
  total: number;
  pagina: number;
  itens: T[];
  temMais: boolean;
  escolher: (texto: string) => T | undefined;
};

export function linhasNumeradas<T>(pagina: Pagina<T>, rotulo: (item: T) => string): string {
  const linhas = pagina.itens.map((item, i) => `${i + 1} - ${rotulo(item)}`).join("\n");
  return pagina.temMais ? `${linhas}\nDigite *mais* para ver as próximas.` : linhas;
}

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

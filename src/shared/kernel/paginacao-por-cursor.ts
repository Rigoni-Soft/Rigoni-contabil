export const TAMANHO_DA_PAGINA = 500;

export async function lerTodasAsPaginas<L>(
  lerPagina: (apos: string | null) => Promise<L[] | null>,
  cursorDe: (linha: L) => string,
): Promise<L[] | null> {
  const todas: L[] = [];
  let apos: string | null = null;
  for (;;) {
    const pagina = await lerPagina(apos);
    if (pagina === null) return null;
    todas.push(...pagina);
    if (pagina.length < TAMANHO_DA_PAGINA) return todas;
    apos = cursorDe(pagina[pagina.length - 1]);
  }
}

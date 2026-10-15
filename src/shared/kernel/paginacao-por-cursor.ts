// O PostgREST corta a resposta em `max_rows` (supabase/config.toml), também nas funções: uma única
// chamada não representa todos os Clientes. As RPCs de leitura dos jobs devolvem páginas em ordem
// de `cliente_id`, e o cursor é o último `cliente_id` da página anterior (estável mesmo quando o
// próprio job tira Clientes do conjunto). O tamanho fica abaixo do `max_rows` do banco.
export const TAMANHO_DA_PAGINA = 500;

// Lê até a primeira página incompleta. `null` de uma página é falha: devolve null em vez de uma
// lista parcial, para a rodada não tomar o que leu pelo conjunto inteiro.
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

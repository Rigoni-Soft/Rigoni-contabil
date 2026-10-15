import { lerTodasAsPaginas, TAMANHO_DA_PAGINA } from "./paginacao-por-cursor";

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ cliente_id: `c${String(i).padStart(5, "0")}` }));

// Banco simulado: páginas por cursor sobre uma lista ordenada, como a RPC.
function banco(todos: { cliente_id: string }[]) {
  const chamadas: (string | null)[] = [];
  const ler = async (apos: string | null) => {
    chamadas.push(apos);
    return todos.filter((l) => apos === null || l.cliente_id > apos).slice(0, TAMANHO_DA_PAGINA);
  };
  return { ler, chamadas };
}

describe("lerTodasAsPaginas (R87-03)", () => {
  it.each([
    0,
    1,
    TAMANHO_DA_PAGINA - 1,
    TAMANHO_DA_PAGINA,
    TAMANHO_DA_PAGINA + 1,
    2 * TAMANHO_DA_PAGINA,
    1001,
    2001,
  ])("%i Clientes: todos, uma vez, em ordem", async (n) => {
    const { ler } = banco(ids(n));
    const lidos = await lerTodasAsPaginas(ler, (l) => l.cliente_id);
    expect(lidos?.map((l) => l.cliente_id)).toEqual(ids(n).map((l) => l.cliente_id));
  });

  it("página exatamente cheia pede mais uma (a seguinte vem vazia)", async () => {
    const { ler, chamadas } = banco(ids(TAMANHO_DA_PAGINA));
    await lerTodasAsPaginas(ler, (l) => l.cliente_id);
    expect(chamadas).toHaveLength(2);
  });

  it("conjunto que encolhe durante a leitura (o job marca enviados) não pula ninguém", async () => {
    const todos = ids(1200);
    const restantes = new Set(todos.map((l) => l.cliente_id));
    const lidos = await lerTodasAsPaginas(
      async (apos) => {
        const pagina = todos
          .filter((l) => restantes.has(l.cliente_id) && (apos === null || l.cliente_id > apos))
          .slice(0, TAMANHO_DA_PAGINA);
        // O que a página trouxe sai do conjunto antes da próxima: um offset pularia metade.
        pagina.forEach((l) => restantes.delete(l.cliente_id));
        return pagina;
      },
      (l) => l.cliente_id,
    );
    expect(lidos).toHaveLength(1200);
  });

  it("falha em uma página devolve null, não a lista parcial", async () => {
    const todos = ids(1200);
    let chamadas = 0;
    const lidos = await lerTodasAsPaginas(
      async (apos) => {
        chamadas += 1;
        if (chamadas === 2) return null;
        return todos
          .filter((l) => apos === null || l.cliente_id > apos)
          .slice(0, TAMANHO_DA_PAGINA);
      },
      (l) => l.cliente_id,
    );
    expect(lidos).toBeNull();
  });
});

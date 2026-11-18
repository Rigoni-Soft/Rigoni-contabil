import { paginar } from "./paginacao.service";

describe("paginar", () => {
  const sete = ["a", "b", "c", "d", "e", "f", "g"];

  it("divide em páginas e diz se há mais", () => {
    const primeira = paginar(sete, 1, 5);
    expect(primeira).toMatchObject({ total: 2, pagina: 1, itens: ["a", "b", "c", "d", "e"] });
    expect(primeira.temMais).toBe(true);
    const segunda = paginar(sete, 2, 5);
    expect(segunda.itens).toEqual(["f", "g"]);
    expect(segunda.temMais).toBe(false);
  });

  it("lista vazia ainda tem uma página", () => {
    expect(paginar([], 1, 5)).toMatchObject({ total: 1, pagina: 1, itens: [], temMais: false });
  });

  it("página fora do intervalo vira a mais próxima válida", () => {
    expect(paginar(sete, 9, 5).pagina).toBe(2);
    expect(paginar(sete, 0, 5).pagina).toBe(1);
  });

  it("escolhe pelo número impresso, recomeçando em 1 a cada página", () => {
    expect(paginar(sete, 1, 5).escolher("3")).toBe("c");
    expect(paginar(sete, 2, 5).escolher("1")).toBe("f");
    expect(paginar(sete, 2, 5).escolher("3")).toBeUndefined();
  });

  it.each(["0", "01", "007", "-1", "1.5", "um", ""])("%p não escolhe item", (texto) => {
    expect(paginar(sete, 1, 5).escolher(texto)).toBeUndefined();
  });
});

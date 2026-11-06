import { renderHook } from "@testing-library/react";

import { useAnuncioDoMenu } from "./use-anuncio-do-menu.hook";

function renderizar(inicial: { total: number; pronto: boolean; ativo: boolean }) {
  return renderHook(({ total, pronto, ativo }) => useAnuncioDoMenu(total, pronto, ativo), {
    initialProps: inicial,
  });
}

describe("useAnuncioDoMenu", () => {
  it("a primeira leitura é silenciosa; quando cresce, avisa o total (plural e singular)", () => {
    const { result, rerender } = renderizar({ total: 0, pronto: false, ativo: true });

    rerender({ total: 2, pronto: true, ativo: true });
    expect(result.current).toBe("");

    rerender({ total: 3, pronto: true, ativo: true });
    expect(result.current).toBe("Atendimento: 3 pendentes.");
  });

  it("um pendente fala no singular", () => {
    const { result, rerender } = renderizar({ total: 0, pronto: true, ativo: true });

    rerender({ total: 1, pronto: true, ativo: true });

    expect(result.current).toBe("Atendimento: 1 pendente.");
  });

  it("diminuir não é novidade e não avisa", () => {
    const { result, rerender } = renderizar({ total: 3, pronto: true, ativo: true });

    rerender({ total: 2, pronto: true, ativo: true });

    expect(result.current).toBe("");
  });

  it("na tela Atendimento não avisa (a tela tem o próprio aviso) e já guarda a base", () => {
    const { result, rerender } = renderizar({ total: 1, pronto: true, ativo: false });

    rerender({ total: 4, pronto: true, ativo: false });
    expect(result.current).toBe("");

    rerender({ total: 4, pronto: true, ativo: true });
    expect(result.current).toBe("");
  });
});

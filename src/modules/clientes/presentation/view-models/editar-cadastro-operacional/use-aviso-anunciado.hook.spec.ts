import { act, renderHook } from "@testing-library/react";

import { useAvisoAnunciado } from "./use-aviso-anunciado.hook";

describe("useAvisoAnunciado", () => {
  it("começa vazio", () => {
    const { result } = renderHook(() => useAvisoAnunciado());
    expect(result.current).toMatchObject({ aviso: "", avisoVez: 0 });
  });

  it("o mesmo texto anunciado duas vezes muda a vez (a View relê a região) e não suja o texto", () => {
    const { result } = renderHook(() => useAvisoAnunciado());
    act(() => result.current.anunciar("Contato 1 salvo."));
    act(() => result.current.anunciar("Contato 1 salvo."));
    expect(result.current.aviso).toBe("Contato 1 salvo.");
    expect(result.current.avisoVez).toBe(2);
  });
});

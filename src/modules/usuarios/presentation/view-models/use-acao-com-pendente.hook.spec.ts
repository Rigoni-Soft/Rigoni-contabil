import { act, renderHook } from "@testing-library/react";

import { useAcaoComPendente } from "./use-acao-com-pendente.hook";

const refreshMock = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

describe("useAcaoComPendente", () => {
  beforeEach(() => refreshMock.mockReset());

  it("sucesso recarrega e não deixa erro", async () => {
    const { result } = renderHook(() => useAcaoComPendente("falhou"));
    await act(() => result.current.executar(async () => ({ ok: true })));
    expect(refreshMock).toHaveBeenCalled();
    expect(result.current.erro).toBeUndefined();
    expect(result.current.pendente).toBe(false);
  });

  it("erro da ação vira mensagem e não recarrega", async () => {
    const { result } = renderHook(() => useAcaoComPendente("falhou"));
    await act(() =>
      result.current.executar(async () => ({ ok: false, error: { message: "negado" } })),
    );
    expect(result.current.erro).toBe("negado");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("exceção vira a mensagem de falha e libera o pendente", async () => {
    const { result } = renderHook(() => useAcaoComPendente("falhou"));
    await act(() =>
      result.current.executar(async () => {
        throw new Error("x");
      }),
    );
    expect(result.current.erro).toBe("falhou");
    expect(result.current.pendente).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";

import { useAlterarPapel } from "./use-alterar-papel.hook";

const actionMock = jest.fn();
const refreshMock = jest.fn();

jest.mock("./alterar-papel.actions", () => ({
  alterarPapelUsuarioAction: (...args: unknown[]) => actionMock(...args),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

describe("useAlterarPapel", () => {
  beforeEach(() => {
    actionMock.mockReset();
    refreshMock.mockReset();
  });

  it("Funcionário é promovido a Líder e a lista recarrega", async () => {
    actionMock.mockResolvedValue({ ok: true, data: null });
    const { result } = renderHook(() => useAlterarPapel("u1", "lider_setor"));

    await act(() => result.current.aoAlterar());

    expect(actionMock).toHaveBeenCalledWith({ usuarioId: "u1", papel: "lider_setor" });
    expect(refreshMock).toHaveBeenCalled();
    expect(result.current.erro).toBeUndefined();
  });

  it("Líder é rebaixado a Funcionário", async () => {
    actionMock.mockResolvedValue({ ok: true, data: null });
    const { result } = renderHook(() => useAlterarPapel("u1", "funcionario"));

    await act(() => result.current.aoAlterar());

    expect(actionMock).toHaveBeenCalledWith({ usuarioId: "u1", papel: "funcionario" });
  });

  it("erro da action vira mensagem e não recarrega", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "O setor já tem Líder ativo." },
    });
    const { result } = renderHook(() => useAlterarPapel("u1", "lider_setor"));

    await act(() => result.current.aoAlterar());

    expect(result.current.erro).toBe("O setor já tem Líder ativo.");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("exceção da action vira mensagem genérica", async () => {
    actionMock.mockRejectedValue(new Error("rede"));
    const { result } = renderHook(() => useAlterarPapel("u1", "lider_setor"));

    await act(() => result.current.aoAlterar());

    expect(result.current.erro).toMatch(/Não foi possível alterar/);
    expect(result.current.pendente).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";

import { useDesativarUsuario } from "./use-desativar-usuario.hook";

const actionMock = jest.fn();
const refreshMock = jest.fn();

jest.mock("./desativar-usuario.actions", () => ({
  desativarUsuarioAction: (...args: unknown[]) => actionMock(...args),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

describe("useDesativarUsuario", () => {
  beforeEach(() => {
    actionMock.mockReset();
    refreshMock.mockReset();
  });

  it("pedir confirmação e cancelar alterna o estado sem chamar a action", () => {
    const { result } = renderHook(() => useDesativarUsuario("u1"));

    act(() => result.current.aoPedirConfirmacao());
    expect(result.current.confirmando).toBe(true);
    act(() => result.current.aoCancelar());
    expect(result.current.confirmando).toBe(false);
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("confirmar desativa e recarrega a lista", async () => {
    actionMock.mockResolvedValue({ ok: true, data: null });
    const { result } = renderHook(() => useDesativarUsuario("u1"));

    await act(() => result.current.aoConfirmar());

    expect(actionMock).toHaveBeenCalledWith({ usuarioId: "u1" });
    expect(refreshMock).toHaveBeenCalled();
    expect(result.current.erro).toBeUndefined();
  });

  it("erro da action vira mensagem e não recarrega", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Sem acesso." },
    });
    const { result } = renderHook(() => useDesativarUsuario("u1"));

    await act(() => result.current.aoConfirmar());

    expect(result.current.erro).toBe("Sem acesso.");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("exceção da action vira mensagem genérica", async () => {
    actionMock.mockRejectedValue(new Error("rede"));
    const { result } = renderHook(() => useDesativarUsuario("u1"));

    await act(() => result.current.aoConfirmar());

    expect(result.current.erro).toMatch(/Não foi possível desativar/);
    expect(result.current.pendente).toBe(false);
  });
});

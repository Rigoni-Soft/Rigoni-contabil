import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useAssumirAtendimentoMutation } from "./assumir.queries";
import { assumirAtendimentoAction } from "./fila.actions";

jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({}));
jest.mock("./fila.actions", () => ({
  assumirAtendimentoAction: jest.fn(),
  listarFilaAction: jest.fn(),
}));

const acao = jest.mocked(assumirAtendimentoAction);

function renderizar() {
  const cliente = new QueryClient();
  const invalidar = jest.spyOn(cliente, "invalidateQueries");
  const hook = renderHook(() => useAssumirAtendimentoMutation(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, invalidar };
}

describe("useAssumirAtendimentoMutation", () => {
  it("assume o Atendimento e relê a Fila e os atendimentos do usuário", async () => {
    acao.mockResolvedValue({ ok: true, data: undefined });
    const { result, invalidar } = renderizar();

    await act(() => result.current.mutateAsync("at-1"));

    expect(acao).toHaveBeenCalledWith("at-1");
    expect(invalidar).toHaveBeenCalledTimes(2);
  });

  it("quem perde a corrida recebe a mensagem e a Fila é relida mesmo assim", async () => {
    acao.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Atendimento já assumido por outra pessoa." },
    });
    const { result, invalidar } = renderizar();

    await act(async () => {
      result.current.mutate("at-1");
    });

    await waitFor(() =>
      expect(result.current.error?.message).toBe("Atendimento já assumido por outra pessoa."),
    );
    expect(invalidar).toHaveBeenCalledTimes(2);
  });
});

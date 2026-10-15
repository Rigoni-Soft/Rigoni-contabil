import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { SetorSlug } from "@/shared/kernel/setores";

import { listarFilaAction } from "./fila.actions";
import { useFila } from "./use-fila.hook";

jest.mock("./fila.actions", () => ({ listarFilaAction: jest.fn() }));

const acao = jest.mocked(listarFilaAction);
const ITEM = {
  atendimentoId: "at-1",
  posicao: 1,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  resumo: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:00",
  filaDoFuncionarioId: null,
};

function renderizar(setorInicial: SetorSlug = "financeiro") {
  const cliente = new QueryClient();
  return renderHook(() => useFila(setorInicial, [ITEM], true), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useFila", () => {
  beforeEach(() => {
    acao.mockReset();
    acao.mockResolvedValue({ ok: true, data: [ITEM] });
    jest.useFakeTimers({ now: new Date("2026-10-09T12:00:05Z"), doNotFake: ["nextTick"] });
  });
  afterEach(() => jest.useRealTimers());

  it("mostra a carga inicial já com o tempo de espera", () => {
    const { result } = renderizar();

    expect(result.current.itens[0]).toMatchObject({ contato: "Maria", espera: "00:05" });
  });

  it("o cronômetro corre a cada segundo sem nova leitura", () => {
    const { result } = renderizar();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.itens[0].espera).toBe("00:08");
  });

  it("trocar o Setor lê a Fila do novo Setor", async () => {
    const { result } = renderizar();

    act(() => result.current.escolherSetor("rh"));

    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(acao).toHaveBeenCalledWith("rh"));
    expect(result.current.setor).toBe("rh");
    await waitFor(() => expect(result.current.carregando).toBe(false));
  });
});

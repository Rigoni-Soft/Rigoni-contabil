import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { tocarNotificacao } from "@/presentation/lib/notificacao-sonora";

import { listarFilaAction } from "../fila/fila.actions";
import { filaKeys } from "../fila/fila.queries";
import { listarMeusAtendimentosAction } from "../meus-atendimentos/meus-atendimentos.actions";
import { useAvisoGlobal } from "./use-aviso-global.hook";

let pathname = "/perfil";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("../fila/fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));
jest.mock("@/presentation/lib/notificacao-sonora", () => ({
  prepararSom: () => () => undefined,
  tocarNotificacao: jest.fn(),
}));

const espera = (id: string) => ({
  atendimentoId: id,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: null, cnpj: null },
  resumo: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:00",
  filaDoFuncionarioId: null,
  esperaComum: true,
});

function renderizar() {
  const cliente = new QueryClient();
  cliente.setQueryData(filaKeys.setor(null), [espera("e-1")]);
  const hook = renderHook(() => useAvisoGlobal(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
  return { cliente, ...hook };
}

describe("useAvisoGlobal", () => {
  beforeEach(() => {
    pathname = "/perfil";
    jest.mocked(tocarNotificacao).mockReset();
    jest
      .mocked(listarFilaAction)
      .mockReset()
      .mockResolvedValue({ ok: true, data: [] } as never);
    jest
      .mocked(listarMeusAtendimentosAction)
      .mockReset()
      .mockResolvedValue({ ok: true, data: [] } as never);
  });

  it("toca quando surge Atendimento na espera, depois de uma primeira leitura silenciosa", async () => {
    const { cliente } = renderizar();
    await waitFor(() => expect(listarMeusAtendimentosAction).toHaveBeenCalled());
    expect(tocarNotificacao).not.toHaveBeenCalled();

    act(() => cliente.setQueryData(filaKeys.setor(null), [espera("e-1"), espera("e-2")]));

    await waitFor(() => expect(tocarNotificacao).toHaveBeenCalledTimes(1));
  });

  it("na tela Atendimento o som é da tela: não toca", async () => {
    pathname = "/atendimento";
    const { cliente } = renderizar();
    await waitFor(() => expect(listarMeusAtendimentosAction).toHaveBeenCalled());

    act(() => cliente.setQueryData(filaKeys.setor(null), [espera("e-1"), espera("e-2")]));

    expect(tocarNotificacao).not.toHaveBeenCalled();
  });

  it("sem sessão (login) não consulta", () => {
    pathname = "/login";
    renderizar();

    expect(listarFilaAction).not.toHaveBeenCalled();
    expect(listarMeusAtendimentosAction).not.toHaveBeenCalled();
  });
});

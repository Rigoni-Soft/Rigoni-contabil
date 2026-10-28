import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { assumirAtendimentoAction, listarFilaAction } from "../fila/fila.actions";
import { listarMeusAtendimentosAction } from "../meus-atendimentos/meus-atendimentos.actions";
import { useAtendimentoCentralStore } from "./atendimento-central.store";
import { useAtendimentoCentral } from "./use-atendimento-central.hook";

jest.mock("../fila/fila.actions", () => ({
  assumirAtendimentoAction: jest.fn(),
  listarFilaAction: jest.fn(),
}));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));

const assumir = jest.mocked(assumirAtendimentoAction);
const ESPERA = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: null },
  resumo: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:00",
  filaDoFuncionarioId: null,
};
const DIRIGIDO = { ...ESPERA, atendimentoId: "at-2", filaDoFuncionarioId: "outro-usuario" };

function renderizar() {
  const cliente = new QueryClient();
  const renderizado = renderHook(
    () =>
      useAtendimentoCentral({
        usuarioId: "eu",
        setorInicial: "financeiro",
        filaInicial: [ESPERA, DIRIGIDO],
        meusInicial: [],
        podeEscolherSetor: false,
      }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...renderizado, cliente };
}

describe("useAtendimentoCentral", () => {
  beforeEach(() => {
    jest.mocked(listarFilaAction).mockResolvedValue({ ok: true, data: [ESPERA, DIRIGIDO] });
    jest.mocked(listarMeusAtendimentosAction).mockResolvedValue({ ok: true, data: [] });
    assumir.mockReset();
    useAtendimentoCentralStore.setState({ aba: "espera", abertoId: null });
  });

  it("começa na aba Em espera, sem conversa aberta, e só deixa assumir o que não é dirigido a outro", () => {
    const { result } = renderizar();

    expect(result.current.aba).toBe("espera");
    expect(result.current.abertoId).toBeNull();
    expect(result.current.espera.map((c) => [c.id, c.assumivel])).toEqual([
      ["at-1", true],
      ["at-2", false],
    ]);
  });

  it("ao assumir, vai para Em atendimento com a conversa aberta", async () => {
    assumir.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();

    act(() => result.current.assumir("at-1"));

    await waitFor(() => expect(result.current.abertoId).toBe("at-1"));
    expect(result.current.aba).toBe("atendimento");
    expect(assumir).toHaveBeenCalledWith("at-1");
  });

  it("perdendo a corrida, avisa 'já assumido' e continua na espera", async () => {
    assumir.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Atendimento já assumido por outra pessoa." },
    });
    const { result } = renderizar();

    act(() => result.current.assumir("at-1"));

    await waitFor(() =>
      expect(result.current.avisoDeAssuncao).toBe("Atendimento já assumido por outra pessoa."),
    );
    expect(result.current.aba).toBe("espera");
    expect(result.current.abertoId).toBeNull();
  });

  it("fechar a conversa limpa a seleção", async () => {
    assumir.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();
    act(() => result.current.assumir("at-1"));
    await waitFor(() => expect(result.current.abertoId).toBe("at-1"));

    act(() => useAtendimentoCentralStore.getState().fecharConversa());

    expect(result.current.abertoId).toBeNull();
  });

  describe("anúncio de cliente novo na espera", () => {
    const NOVO = { ...ESPERA, atendimentoId: "at-3" };

    it("a primeira leitura é silenciosa e uma entrada vira texto para o leitor de tela", async () => {
      const { result, cliente } = renderizar();
      expect(result.current.anuncio).toBe("");

      jest.mocked(listarFilaAction).mockResolvedValue({ ok: true, data: [ESPERA, DIRIGIDO, NOVO] });
      await act(async () => {
        await cliente.refetchQueries();
      });

      await waitFor(() =>
        expect(result.current.anuncio).toBe("Novo cliente em espera. Total na espera: 3."),
      );
    });
  });

  describe("aviso de 'já assumido'", () => {
    const PERDEU = {
      ok: false as const,
      error: { code: "CONFLICT" as const, message: "Atendimento já assumido por outra pessoa." },
    };

    it("some ao trocar de aba", async () => {
      assumir.mockResolvedValue(PERDEU);
      const { result } = renderizar();
      act(() => result.current.assumir("at-1"));
      await waitFor(() => expect(result.current.avisoDeAssuncao).toBeDefined());

      act(() => result.current.escolherAba("atendimento"));

      expect(result.current.avisoDeAssuncao).toBeUndefined();
    });

    it("some sozinho depois de alguns segundos", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick"] });
      try {
        assumir.mockResolvedValue(PERDEU);
        const { result } = renderizar();
        act(() => result.current.assumir("at-1"));
        await waitFor(() => expect(result.current.avisoDeAssuncao).toBeDefined());

        act(() => {
          jest.advanceTimersByTime(8_000);
        });

        expect(result.current.avisoDeAssuncao).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

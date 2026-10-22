import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { AvisoCadastroDto } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";

import { useSinoAvisos } from "./use-sino-avisos.hook";

const push = jest.fn();
let pathname = "/";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const contarMock = jest.fn();
const listarMock = jest.fn();
const marcarMock = jest.fn();
jest.mock("./avisos-cadastro.actions", () => ({
  contarAvisosNaoVistosAction: () => contarMock(),
  listarAvisosCadastroAction: (cursor: unknown) => listarMock(cursor),
  marcarAvisoVistoAction: (id: string) => marcarMock(id),
}));

const aviso = (id: string, vistoEm: string | null = null): AvisoCadastroDto => ({
  id,
  tipo: "novo_cliente",
  clienteId: `c-${id}`,
  alteracaoId: null,
  criadoEm: "2026-10-22T15:30:00.000Z",
  vistoEm,
});

function renderizar() {
  const client = new QueryClient();
  return renderHook(() => useSinoAvisos(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("useSinoAvisos", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    pathname = "/";
    contarMock.mockResolvedValue({ ok: true, data: 2 });
    marcarMock.mockResolvedValue({ ok: true, data: undefined });
  });

  it("lê o contador ao montar e não lê a lista antes de abrir", async () => {
    const { result } = renderizar();

    await waitFor(() => expect(result.current.contador).toBe(2));
    expect(listarMock).not.toHaveBeenCalled();
  });

  it("falha na leitura do contador mantém zero sem quebrar", async () => {
    contarMock.mockResolvedValue({ ok: false, error: { code: "UNAUTHORIZED", message: "x" } });
    const { result } = renderizar();

    await waitFor(() => expect(contarMock).toHaveBeenCalled());
    expect(result.current.contador).toBe(0);
  });

  it("a cada navegação o contador é lido de novo", async () => {
    const { rerender } = renderizar();
    await waitFor(() => expect(contarMock).toHaveBeenCalledTimes(1));

    pathname = "/clientes/c1";
    rerender();

    await waitFor(() => expect(contarMock).toHaveBeenCalledTimes(2));
  });

  it("polling de 30 s relê o contador", async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(result.current.contador).toBe(2);
      contarMock.mockResolvedValue({ ok: true, data: 3 });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_000);
        await jest.advanceTimersByTimeAsync(1);
      });

      expect(result.current.contador).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it("abrir carrega a primeira página; 'carregar mais' usa o cursor da página anterior", async () => {
    const cursor = { visto: false, criadoEm: "2026-10-22T15:30:00.000Z", id: "a1" };
    listarMock
      .mockResolvedValueOnce({ ok: true, data: { itens: [aviso("a1")], proximoCursor: cursor } })
      .mockResolvedValueOnce({
        ok: true,
        data: { itens: [aviso("a2", "2026-10-22T16:00:00.000Z")], proximoCursor: null },
      });
    const { result } = renderizar();

    act(() => result.current.aoAbrir());
    await waitFor(() => expect(result.current.avisos).toHaveLength(1));
    expect(listarMock).toHaveBeenCalledWith(null);
    expect(result.current.temMais).toBe(true);
    expect(marcarMock).not.toHaveBeenCalled();

    act(() => result.current.aoCarregarMais());
    await waitFor(() => expect(result.current.avisos).toHaveLength(2));
    expect(listarMock).toHaveBeenLastCalledWith(cursor);
    expect(result.current.avisos[1].visto).toBe(true);
    expect(result.current.temMais).toBe(false);
  });

  it("clicar num aviso não visto marca como visto, navega ao Cliente e relê o contador", async () => {
    listarMock.mockResolvedValue({ ok: true, data: { itens: [aviso("a1")], proximoCursor: null } });
    const { result } = renderizar();
    act(() => result.current.aoAbrir());
    await waitFor(() => expect(result.current.avisos).toHaveLength(1));
    contarMock.mockResolvedValue({ ok: true, data: 1 });

    await act(() => result.current.aoSelecionar(result.current.avisos[0]));

    expect(marcarMock).toHaveBeenCalledWith("a1");
    expect(push).toHaveBeenCalledWith("/clientes/c-a1");
    await waitFor(() => expect(result.current.contador).toBe(1));
  });

  it("clicar num aviso já visto só navega", async () => {
    listarMock.mockResolvedValue({
      ok: true,
      data: { itens: [aviso("a1", "2026-10-22T16:00:00.000Z")], proximoCursor: null },
    });
    const { result } = renderizar();
    act(() => result.current.aoAbrir());
    await waitFor(() => expect(result.current.avisos).toHaveLength(1));

    await act(() => result.current.aoSelecionar(result.current.avisos[0]));

    expect(marcarMock).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/clientes/c-a1");
  });

  it("'tentar de novo' relê a lista depois de uma falha", async () => {
    listarMock.mockResolvedValueOnce({ ok: false, error: { code: "INTERNAL", message: "x" } });
    const { result } = renderizar();
    act(() => result.current.aoAbrir());
    await waitFor(() => expect(result.current.estado).toBe("erro"));
    listarMock.mockResolvedValue({ ok: true, data: { itens: [aviso("a1")], proximoCursor: null } });

    act(() => result.current.aoTentarDeNovo());

    await waitFor(() => expect(result.current.estado).toBe("pronto"));
    expect(result.current.avisos).toHaveLength(1);
  });
});

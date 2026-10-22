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
  alteracaoNumero: null,
  criadoEm: "2026-10-22T15:30:00.000Z",
  vistoEm,
});

function renderizar(papel = "lider_setor") {
  const client = new QueryClient();
  return renderHook(() => useSinoAvisos("painel", papel), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

// O jsdom não implementa showModal/close: o <dialog> do teste guarda só o estado `open`.
let modal: HTMLDialogElement;

describe("useSinoAvisos", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    document.body.innerHTML = '<dialog id="painel"></dialog>';
    modal = document.getElementById("painel") as HTMLDialogElement;
    modal.open = false;
    modal.showModal = jest.fn(() => {
      modal.open = true;
    });
    modal.close = jest.fn(() => {
      modal.open = false;
    });
    pathname = "/";
    contarMock.mockResolvedValue({ ok: true, data: 2 });
    marcarMock.mockResolvedValue({ ok: true, data: undefined });
  });

  it("lê o contador ao montar e não lê a lista antes de abrir", async () => {
    const { result } = renderizar();

    await waitFor(() => expect(result.current.contador).toBe(2));
    expect(contarMock).toHaveBeenCalledTimes(1);
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

  it("anuncia só quando o contador sobe depois da primeira leitura", async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderizar();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(result.current.contador).toBe(2);
      expect(result.current.anuncio).toBe("");

      contarMock.mockResolvedValue({ ok: true, data: 3 });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.anuncio).toBe("3 avisos de cadastro não vistos");

      contarMock.mockResolvedValue({ ok: true, data: 1 });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.anuncio).toBe("");
    } finally {
      jest.useRealTimers();
    }
  });

  it("abrir o sino abre o modal uma vez só; fechar e selecionar o fecham", async () => {
    listarMock.mockResolvedValue({ ok: true, data: { itens: [aviso("a1")], proximoCursor: null } });
    const { result } = renderizar();

    act(() => result.current.aoAbrir());
    act(() => result.current.aoAbrir());
    expect(modal.showModal).toHaveBeenCalledTimes(1);

    act(() => result.current.aoFechar());
    expect(modal.close).toHaveBeenCalledTimes(1);

    act(() => result.current.aoAbrir());
    await waitFor(() => expect(result.current.avisos).toHaveLength(1));
    await act(() => result.current.aoSelecionar(result.current.avisos[0]));
    expect(modal.close).toHaveBeenCalledTimes(2);
  });

  it("Admin não recebe aviso: não lê o contador, nem no polling nem na navegação", async () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = renderizar("admin");
      pathname = "/clientes/c1";
      rerender();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });

      expect(contarMock).not.toHaveBeenCalled();
      expect(result.current.contador).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

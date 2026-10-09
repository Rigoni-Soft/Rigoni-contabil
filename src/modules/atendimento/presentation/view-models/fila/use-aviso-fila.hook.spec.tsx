import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { prepararSom, tocarNotificacao } from "@/presentation/lib/notificacao-sonora";

import { listarFilaAction } from "./fila.actions";
import { useAvisoFila } from "./use-aviso-fila.hook";

jest.mock("./fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("@/presentation/lib/notificacao-sonora", () => ({
  prepararSom: jest.fn(),
  tocarNotificacao: jest.fn(),
}));

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

const acao = jest.mocked(listarFilaAction);
const tocar = jest.mocked(tocarNotificacao);
const item = (id: string) => ({
  atendimentoId: id,
  posicao: 1,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: null, cnpj: null },
  resumo: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:00",
  filaDoFuncionarioId: null,
});

function renderizar() {
  const cliente = new QueryClient();
  const hook = renderHook(() => useAvisoFila(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
  const reler = () => act(() => cliente.refetchQueries());
  return { ...hook, reler };
}

describe("useAvisoFila", () => {
  beforeEach(() => {
    acao.mockReset();
    tocar.mockReset();
    pathname = "/";
  });

  it("prepara o som e lê a Fila do próprio Setor (sem informar Setor)", async () => {
    acao.mockResolvedValue({ ok: true, data: [item("a")] });

    renderizar();

    await waitFor(() => expect(acao).toHaveBeenCalledWith(undefined));
    expect(prepararSom).toHaveBeenCalled();
  });

  it("fora da conversa e da Fila mostra o aviso; a primeira leitura é silenciosa", async () => {
    acao.mockResolvedValue({ ok: true, data: [item("a")] });

    const { result } = renderizar();

    await waitFor(() => expect(result.current.aviso).toMatchObject({ href: "/fila" }));
    expect(tocar).not.toHaveBeenCalled();
  });

  it.each(["/fila", "/atendimento/at-1"])(
    "em %s não mostra o aviso (a Fila já está na tela)",
    async (rota) => {
      pathname = rota;
      acao.mockResolvedValue({ ok: true, data: [item("a")] });

      const { result } = renderizar();

      await waitFor(() => expect(acao).toHaveBeenCalled());
      expect(result.current.aviso).toBeNull();
    },
  );

  it.each(["/login", "/trocar-senha"])("em %s não consulta", (rota) => {
    pathname = rota;

    renderizar();

    expect(acao).not.toHaveBeenCalled();
  });

  it("toca quando alguém entra na Fila, em qualquer tela, e não repete se nada mudou", async () => {
    pathname = "/atendimento/at-1";
    acao.mockResolvedValue({ ok: true, data: [item("a")] });
    const { reler } = renderizar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    await act(async () => {}); // a primeira leitura chega ao hook antes da segunda

    acao.mockResolvedValue({ ok: true, data: [item("a"), item("b")] });
    await reler();
    await waitFor(() => expect(tocar).toHaveBeenCalledTimes(1));

    await reler();
    expect(tocar).toHaveBeenCalledTimes(1);
  });

  it("saída da Fila não toca", async () => {
    acao.mockResolvedValue({ ok: true, data: [item("a"), item("b")] });
    const { reler } = renderizar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    await act(async () => {});

    acao.mockResolvedValue({ ok: true, data: [item("b")] });
    await reler();

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(2));
    expect(tocar).not.toHaveBeenCalled();
  });
});

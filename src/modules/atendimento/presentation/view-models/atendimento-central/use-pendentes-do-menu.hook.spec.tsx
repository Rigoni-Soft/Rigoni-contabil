import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { listarFilaAction } from "../fila/fila.actions";
import { listarMeusAtendimentosAction } from "../meus-atendimentos/meus-atendimentos.actions";
import { usePendentesDoMenu } from "./use-pendentes-do-menu.hook";

jest.mock("../fila/fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));

const ESPERA = {
  atendimentoId: "e-1",
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: null, cnpj: null },
  resumo: null,
  filaDesde: new Date("2026-10-09T12:00:00Z"),
  espera: "00:00",
  filaDoFuncionarioId: null,
};
const conversa = (id: string, autor: "contato" | "funcionario") => ({
  atendimentoId: id,
  telefone: "5561988887777",
  criadoEm: "2026-10-08T12:00:00Z",
  ultimaMensagem: { autor, texto: "oi", criadoEm: "2026-10-08T12:05:00Z", anexoTipo: null },
  contato: { contatoNome: "João", empresa: null, cnpj: null },
});

function renderizar() {
  return renderHook(() => usePendentesDoMenu(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    ),
  });
}

describe("usePendentesDoMenu", () => {
  it("soma a espera e as conversas com o cliente aguardando", async () => {
    jest.mocked(listarFilaAction).mockResolvedValue({ ok: true, data: [ESPERA] });
    jest.mocked(listarMeusAtendimentosAction).mockResolvedValue({
      ok: true,
      data: [conversa("a-1", "contato"), conversa("a-2", "funcionario")],
    });

    const { result } = renderizar();

    expect(result.current).toEqual({ total: 0, pronto: false });
    await waitFor(() => expect(result.current).toEqual({ total: 2, pronto: true }));
  });

  it("é zero enquanto não há leitura ou quando a Fila é negada (Admin sem Setor)", async () => {
    jest.mocked(listarFilaAction).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "negado" },
    } as never);
    jest.mocked(listarMeusAtendimentosAction).mockResolvedValue({ ok: true, data: [] });

    const { result } = renderizar();

    // negada é leitura encerrada: vale zero, e a leitura de Atendimentos segue contando
    await waitFor(() => expect(result.current.pronto).toBe(true));
    expect(result.current.total).toBe(0);
  });
});

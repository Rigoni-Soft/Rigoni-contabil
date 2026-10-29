import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { listarFilaAction } from "../fila/fila.actions";
import { filaKeys } from "../fila/fila.queries";
import { listarMeusAtendimentosAction } from "../meus-atendimentos/meus-atendimentos.actions";
import { meusAtendimentosKeys } from "../meus-atendimentos/meus-atendimentos.queries";
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
  esperaComum: true,
};
const conversa = (id: string, autor: "contato" | "funcionario") => ({
  atendimentoId: id,
  telefone: "5561988887777",
  criadoEm: "2026-10-08T12:00:00Z",
  ultimaMensagem: { autor, texto: "oi", criadoEm: "2026-10-08T12:05:00Z", anexoTipo: null },
  contato: { contatoNome: "João", empresa: null, cnpj: null },
});

// O contador só lê o cache: quem consulta e repete a leitura (polling) são o aviso global do Dock e
// a tela Atendimento. Um observador a mais com o próprio intervalo dobraria as chamadas.
function renderizar(preencher: (cliente: QueryClient) => void = () => {}) {
  const cliente = new QueryClient();
  preencher(cliente);
  return renderHook(() => usePendentesDoMenu(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("usePendentesDoMenu", () => {
  beforeEach(() => {
    jest.mocked(listarFilaAction).mockReset();
    jest.mocked(listarMeusAtendimentosAction).mockReset();
  });

  it("soma a espera e as conversas com o cliente aguardando que já estão no cache", () => {
    const { result } = renderizar((cliente) => {
      cliente.setQueryData(filaKeys.setor(null), [ESPERA]);
      cliente.setQueryData(meusAtendimentosKeys.lista(), [
        conversa("a-1", "contato"),
        conversa("a-2", "funcionario"),
      ]);
    });

    expect(result.current).toEqual({ total: 2, pronto: true });
  });

  it("não consulta por conta própria: sem leitura no cache é zero e não pronto", () => {
    const { result } = renderizar();

    expect(result.current).toEqual({ total: 0, pronto: false });
    expect(listarFilaAction).not.toHaveBeenCalled();
    expect(listarMeusAtendimentosAction).not.toHaveBeenCalled();
  });

  it("Fila negada (Admin sem Setor) é leitura encerrada: vale zero e as conversas seguem contando", async () => {
    const { result } = renderizar((cliente) => {
      cliente.setQueryData(meusAtendimentosKeys.lista(), [conversa("a-1", "contato")]);
      // erro da Fila no cache, como o Dock o deixa
      void cliente
        .fetchQuery({
          queryKey: filaKeys.setor(null),
          queryFn: () => Promise.reject(new Error("negado")),
          retry: false,
        })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current).toEqual({ total: 1, pronto: true }));
  });
});

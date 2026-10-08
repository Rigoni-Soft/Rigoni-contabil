import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { listarMeusAtendimentosAction } from "./meus-atendimentos.actions";
import { useMeusAtendimentos } from "./use-meus-atendimentos.hook";

jest.mock("./meus-atendimentos.actions", () => ({ listarMeusAtendimentosAction: jest.fn() }));

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

const acao = jest.mocked(listarMeusAtendimentosAction);
const ATENDIMENTO = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  criadoEm: "2026-10-08T12:00:00Z",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
};

function renderizar() {
  const cliente = new QueryClient();
  return renderHook(() => useMeusAtendimentos(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useMeusAtendimentos", () => {
  beforeEach(() => {
    acao.mockReset();
    pathname = "/";
  });

  it("devolve os Atendimentos em andamento prontos para a View", async () => {
    acao.mockResolvedValue({ ok: true, data: [ATENDIMENTO] });

    const { result } = renderizar();

    await waitFor(() => expect(result.current.atendimentos).toHaveLength(1));
    expect(result.current.atendimentos[0]).toMatchObject({
      href: "/atendimento/at-1",
      titulo: "Maria",
    });
  });

  it.each(["/login", "/trocar-senha", "/atendimento/at-1"])(
    "em %s não consulta nem mostra nada",
    async (rota) => {
      pathname = rota;
      acao.mockResolvedValue({ ok: true, data: [ATENDIMENTO] });

      const { result } = renderizar();

      expect(result.current.atendimentos).toEqual([]);
      expect(acao).not.toHaveBeenCalled();
    },
  );

  it("falha de leitura (ex.: sem sessão) não mostra nada", async () => {
    acao.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN", message: "Faça login." } });

    const { result } = renderizar();

    await waitFor(() => expect(acao).toHaveBeenCalled());
    expect(result.current.atendimentos).toEqual([]);
  });
});

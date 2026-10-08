import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { prepararSom, tocarNotificacao } from "@/presentation/lib/notificacao-sonora";

import { listarMeusAtendimentosAction } from "./meus-atendimentos.actions";
import { useMeusAtendimentos } from "./use-meus-atendimentos.hook";

jest.mock("./meus-atendimentos.actions", () => ({ listarMeusAtendimentosAction: jest.fn() }));

jest.mock("@/presentation/lib/notificacao-sonora", () => ({
  prepararSom: jest.fn(),
  tocarNotificacao: jest.fn(),
}));

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

const acao = jest.mocked(listarMeusAtendimentosAction);
const tocar = jest.mocked(tocarNotificacao);
const ATENDIMENTO = {
  atendimentoId: "at-1",
  telefone: "5561988887777",
  criadoEm: "2026-10-08T12:00:00Z",
  ultimaMensagem: null,
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
};

function renderizar() {
  const cliente = new QueryClient();
  const hook = renderHook(() => useMeusAtendimentos(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
  // Uma nova leitura, como a do polling.
  const reler = () => act(() => cliente.refetchQueries());
  return { ...hook, reler };
}

const DO_CLIENTE = (criadoEm: string) => ({
  ...ATENDIMENTO,
  ultimaMensagem: { autor: "contato" as const, texto: "oi", criadoEm },
});

describe("useMeusAtendimentos", () => {
  beforeEach(() => {
    acao.mockReset();
    tocar.mockReset();
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

  describe("aviso sonoro", () => {
    it("prepara o som no primeiro gesto do usuário", () => {
      acao.mockResolvedValue({ ok: true, data: [] });

      renderizar();

      expect(prepararSom).toHaveBeenCalled();
    });

    it("a primeira leitura é silenciosa: o que já estava lá ao abrir a tela não é novidade", async () => {
      acao.mockResolvedValue({ ok: true, data: [DO_CLIENTE("t1")] });

      const { result } = renderizar();

      await waitFor(() => expect(result.current.atendimentos).toHaveLength(1));
      expect(tocar).not.toHaveBeenCalled();
    });

    it("toca quando surge um Atendimento", async () => {
      acao.mockResolvedValue({ ok: true, data: [ATENDIMENTO] });
      const { result, reler } = renderizar();
      await waitFor(() => expect(result.current.atendimentos).toHaveLength(1));

      acao.mockResolvedValue({
        ok: true,
        data: [ATENDIMENTO, { ...ATENDIMENTO, atendimentoId: "at-2" }],
      });
      await reler();

      await waitFor(() => expect(result.current.atendimentos).toHaveLength(2));
      expect(tocar).toHaveBeenCalledTimes(1);
    });

    it("toca quando o cliente escreve de novo, e não repete se nada mudou", async () => {
      acao.mockResolvedValue({ ok: true, data: [DO_CLIENTE("t1")] });
      const { result, reler } = renderizar();
      await waitFor(() => expect(result.current.atendimentos).toHaveLength(1));

      acao.mockResolvedValue({ ok: true, data: [DO_CLIENTE("t2")] });
      await reler();
      await waitFor(() => expect(result.current.atendimentos[0].sinal).toBe("t2"));
      expect(tocar).toHaveBeenCalledTimes(1);

      await reler();
      expect(tocar).toHaveBeenCalledTimes(1);
    });

    it("resposta do próprio Funcionário não toca", async () => {
      acao.mockResolvedValue({ ok: true, data: [DO_CLIENTE("t1")] });
      const { result, reler } = renderizar();
      await waitFor(() => expect(result.current.atendimentos).toHaveLength(1));

      acao.mockResolvedValue({
        ok: true,
        data: [
          {
            ...ATENDIMENTO,
            ultimaMensagem: { autor: "funcionario" as const, texto: "ok", criadoEm: "t2" },
          },
        ],
      });
      await reler();

      await waitFor(() => expect(result.current.atendimentos[0].sinal).toBe("t2"));
      expect(tocar).not.toHaveBeenCalled();
    });
  });
});

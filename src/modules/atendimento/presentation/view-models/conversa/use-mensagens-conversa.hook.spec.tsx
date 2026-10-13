import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { obterConversaAction, reagirAMensagemAction } from "./conversa.actions";
import { useMensagensConversa } from "./use-mensagens-conversa.hook";

jest.mock("./conversa.actions", () => ({
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  reagirAMensagemAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const reagir = jest.mocked(reagirAMensagemAction);
const obter = jest.mocked(obterConversaAction);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [],
  ultimaTransferencia: null,
  ura: null,
  avisoInatividade: false,
  setoresDestino: [],
  documentos: [],
};

function renderizar(conversa: ConversaVista = CONVERSA) {
  const cliente = new QueryClient();
  return renderHook(() => useMensagensConversa("at-1", conversa), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useMensagensConversa — reação (#84)", () => {
  beforeEach(() => {
    reagir.mockReset();
    obter.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("abre o seletor de uma Mensagem por vez e alterna ao repetir", () => {
    const { result } = renderizar();

    act(() => result.current.reacao.aoAlternar("m1", new DOMRect(0, 0, 28, 28)));
    expect(result.current.reacao.abertaId).toBe("m1");
    act(() => result.current.reacao.aoAlternar("m2", new DOMRect(0, 0, 28, 28)));
    expect(result.current.reacao.abertaId).toBe("m2");
    act(() => result.current.reacao.aoAlternar("m2", new DOMRect(0, 0, 28, 28)));
    expect(result.current.reacao.abertaId).toBeNull();
  });

  it("escolher o emoji reage à Mensagem e fecha o seletor", async () => {
    reagir.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();
    act(() => result.current.reacao.aoAlternar("m1", new DOMRect(0, 0, 28, 28)));

    act(() => result.current.reacao.aoEscolher("m1", "👍"));

    expect(result.current.reacao.abertaId).toBeNull();
    await waitFor(() =>
      expect(reagir).toHaveBeenCalledWith({ atendimentoId: "at-1", mensagemId: "m1", emoji: "👍" }),
    );
  });

  it("falha ao reagir mostra o erro; conversa encerrada desliga a reação", async () => {
    reagir.mockResolvedValue({
      ok: false,
      error: { code: "SERVICO_EXTERNO", message: "Falha ao enviar a reação." },
    });
    const { result } = renderizar();

    act(() => result.current.reacao.aoEscolher("m1", "👍"));

    await waitFor(() => expect(result.current.reacao.erro).toBe("Falha ao enviar a reação."));
    expect(result.current.reacao.ativa).toBe(true);
    expect(renderizar({ ...CONVERSA, encerrado: true }).result.current.reacao.ativa).toBe(false);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { enviarMensagemAction, obterConversaAction } from "./conversa.actions";
import { useCompositor } from "./use-compositor.hook";

jest.mock("./conversa.actions", () => ({
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const mensagem = jest.mocked(enviarMensagemAction);
const obter = jest.mocked(obterConversaAction);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [],
  ultimaTransferencia: null,
  setoresDestino: [],
  documentos: [],
};

function renderizar(conversa: ConversaVista = CONVERSA) {
  const cliente = new QueryClient();
  return renderHook(() => useCompositor("at-1", conversa), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useCompositor", () => {
  beforeEach(() => {
    mensagem.mockReset();
    obter.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("está visível num Atendimento em andamento e escondido num encerrado", () => {
    expect(renderizar().result.current.visivel).toBe(true);
    expect(renderizar({ ...CONVERSA, encerrado: true }).result.current.visivel).toBe(false);
  });

  it("envia a mensagem e conta o envio para esvaziar o campo", async () => {
    mensagem.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();

    act(() => result.current.aoEnviar("Bom dia"));

    await waitFor(() => expect(result.current.enviadas).toBe(1));
    expect(mensagem).toHaveBeenCalledWith({ atendimentoId: "at-1", texto: "Bom dia" });
  });

  it("falha ao enviar mostra o erro e não conta o envio", async () => {
    mensagem.mockResolvedValue({
      ok: false,
      error: { code: "SERVICO_EXTERNO", message: "Falha ao enviar a mensagem." },
    });
    const { result } = renderizar();

    act(() => result.current.aoEnviar("Bom dia"));

    await waitFor(() => expect(result.current.erro).toBe("Falha ao enviar a mensagem."));
    expect(result.current.enviadas).toBe(0);
  });
});

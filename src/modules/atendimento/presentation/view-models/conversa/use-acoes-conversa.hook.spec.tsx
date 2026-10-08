import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import {
  enviarDocumentoAction,
  obterConversaAction,
  transferirAtendimentoAction,
} from "./conversa.actions";
import { useAcoesConversa } from "./use-acoes-conversa.hook";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

jest.mock("./conversa.actions", () => ({
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const enviar = jest.mocked(enviarDocumentoAction);
const obter = jest.mocked(obterConversaAction);
const transferir = jest.mocked(transferirAtendimentoAction);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [],
  setoresDestino: ["recepcao", "tributario"],
  documentos: [
    { tipo: "contrato", data: null, descricao: "Contrato social" },
    { tipo: "alteracao", data: "2026-03-01", descricao: "Alteração de 01/03/2026" },
  ],
};

function renderizar(conversa: ConversaVista = CONVERSA) {
  const cliente = new QueryClient();
  return renderHook(() => useAcoesConversa("at-1", conversa), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useAcoesConversa", () => {
  beforeEach(() => {
    enviar.mockReset();
    push.mockReset();
    obter.mockReset();
    transferir.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("expõe os serviços e os Setores de destino da conversa", () => {
    const { result } = renderizar();

    expect(result.current.visivel).toBe(true);
    expect(result.current.servicos.map((s) => s.valor)).toEqual([
      "contrato",
      "alteracao:2026-03-01",
    ]);
    expect(result.current.setoresDestino.map((s) => s.rotulo)).toEqual(["Recepção", "Tributário"]);
  });

  it("encerrado não mostra ações", () => {
    const { result } = renderizar({ ...CONVERSA, encerrado: true });

    expect(result.current.visivel).toBe(false);
  });

  it("envia o documento escolhido e avisa o sucesso", async () => {
    enviar.mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderizar();

    act(() => result.current.aoEnviarServico("alteracao:2026-03-01"));

    await waitFor(() => expect(result.current.aviso?.tipo).toBe("sucesso"));
    expect(enviar).toHaveBeenCalledWith({
      atendimentoId: "at-1",
      documento: { tipo: "alteracao", data: "2026-03-01" },
    });
  });

  it("mostra o erro do envio", async () => {
    enviar.mockResolvedValue({
      ok: false,
      error: { code: "SERVICO_EXTERNO", message: "Falha ao enviar o documento." },
    });
    const { result } = renderizar();

    act(() => result.current.aoEnviarServico("contrato"));

    await waitFor(() =>
      expect(result.current.aviso).toEqual({ tipo: "erro", texto: "Falha ao enviar o documento." }),
    );
  });

  it("transfere para o Setor escolhido, passa a mostrar para onde foi e volta ao início", async () => {
    transferir.mockResolvedValue({ ok: true, data: { proximoDaFila: null } as never });
    const { result } = renderizar();

    act(() => result.current.aoTransferir("tributario", "DAS em atraso"));

    await waitFor(() => expect(result.current.transferidoPara).toBe("Tributário"));
    expect(result.current.visivel).toBe(true);
    expect(transferir).toHaveBeenCalledWith({
      atendimentoId: "at-1",
      setorDestino: "tributario",
      resumo: "DAS em atraso",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("se ficou livre e assumiu o próximo da Fila, abre a conversa dele", async () => {
    transferir.mockResolvedValue({ ok: true, data: { proximoDaFila: "at-2" } as never });
    const { result } = renderizar();

    act(() => result.current.aoTransferir("tributario", "DAS"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/atendimento/at-2"));
  });

  it("mostra o erro da transferência e não marca como transferido", async () => {
    transferir.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Só Cliente do Simples Nacional ou MEI." },
    });
    const { result } = renderizar();

    act(() => result.current.aoTransferir("tributario", "x"));

    await waitFor(() =>
      expect(result.current.avisoTransferencia).toEqual({
        tipo: "erro",
        texto: "Só Cliente do Simples Nacional ou MEI.",
      }),
    );
    expect(result.current.transferidoPara).toBeUndefined();
    expect(push).not.toHaveBeenCalled();
  });
});

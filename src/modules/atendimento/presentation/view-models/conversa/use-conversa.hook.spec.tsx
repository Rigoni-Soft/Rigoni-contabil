import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import {
  enviarDocumentoAction,
  obterConversaAction,
  transferirAtendimentoAction,
} from "./conversa.actions";
import { useConversa } from "./use-conversa.hook";

jest.mock("./conversa.actions", () => ({
  enviarDocumentoAction: jest.fn(),
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

function renderizar() {
  const cliente = new QueryClient();
  return renderHook(() => useConversa("at-1", CONVERSA), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

describe("useConversa", () => {
  beforeEach(() => {
    enviar.mockReset();
    obter.mockReset();
    transferir.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("parte da conversa carregada no servidor", () => {
    const { result } = renderizar();

    expect(result.current.titulo).toBe("Maria");
    expect(result.current.servicos.map((s) => s.valor)).toEqual([
      "contrato",
      "alteracao:2026-03-01",
    ]);
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

  it("transfere para o Setor escolhido e troca as ações pelo aviso de transferido", async () => {
    transferir.mockResolvedValue({ ok: true, data: {} as never });
    const { result } = renderizar();

    act(() => result.current.aoTransferir("tributario", "DAS em atraso"));

    await waitFor(() => expect(result.current.transferidoPara).toBe("Tributário"));
    expect(transferir).toHaveBeenCalledWith({
      atendimentoId: "at-1",
      setorDestino: "tributario",
      resumo: "DAS em atraso",
    });
  });

  it("mostra o erro da transferência", async () => {
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
  });
});

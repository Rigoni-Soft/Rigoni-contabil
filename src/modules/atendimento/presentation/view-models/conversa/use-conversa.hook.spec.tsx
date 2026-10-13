import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { obterConversaAction, transferirAtendimentoAction } from "./conversa.actions";
import { conversaKeys, useTransferirAtendimentoMutation } from "./conversa.queries";
import { useCabecalhoConversa } from "./use-cabecalho-conversa.hook";
import { useMensagensConversa } from "./use-mensagens-conversa.hook";

jest.mock("./conversa.actions", () => ({
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const obter = jest.mocked(obterConversaAction);
const transferir = jest.mocked(transferirAtendimentoAction);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [
    { id: "m1", autor: "contato", texto: "oi", criadoEm: "2026-10-08T15:30:00Z", atendente: null },
  ],
  ultimaTransferencia: null,
  ura: null,
  avisoInatividade: false,
  setoresDestino: ["recepcao", "tributario"],
  documentos: [],
};

function criarWrapper() {
  const cliente = new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

describe("regiões da conversa que leem a mesma consulta", () => {
  beforeEach(() => {
    obter.mockReset();
    transferir.mockReset();
    obter.mockResolvedValue({ ok: true, data: CONVERSA });
  });

  it("o cabeçalho parte da conversa carregada no servidor", () => {
    const { result } = renderHook(() => useCabecalhoConversa("at-1", CONVERSA), {
      wrapper: criarWrapper(),
    });

    expect(result.current).toEqual({
      titulo: "Maria",
      subtitulo: "Padaria Ltda · 11.444.777/0001-61 · (61) 98888-7777",
      encerrado: false,
      avisoInatividade: false,
      contexto: null,
      resumoLongo: false,
      resumoAberto: false,
      alternarResumo: expect.any(Function),
    });
  });

  it("o cabeçalho repassa o aviso de inatividade ao Funcionário", () => {
    const { result } = renderHook(
      () => useCabecalhoConversa("at-1", { ...CONVERSA, avisoInatividade: true }),
      { wrapper: criarWrapper() },
    );

    expect(result.current.avisoInatividade).toBe(true);
  });

  it("resumo de mais de 160 caracteres é longo e o cabeçalho alterna entre recolhido e aberto", () => {
    const longa = {
      ...CONVERSA,
      ultimaTransferencia: {
        setorOrigem: "recepcao" as const,
        origemNome: null,
        resumo: "x".repeat(161),
      },
    };
    const { result } = renderHook(() => useCabecalhoConversa("at-1", longa), {
      wrapper: criarWrapper(),
    });
    expect(result.current.resumoLongo).toBe(true);
    expect(result.current.resumoAberto).toBe(false);

    act(() => result.current.alternarResumo());
    expect(result.current.resumoAberto).toBe(true);
    act(() => result.current.alternarResumo());
    expect(result.current.resumoAberto).toBe(false);
  });

  it("resumo novo chega recolhido, mesmo se o anterior estava aberto", async () => {
    const resumoDe = (resumo: string) => ({
      ...CONVERSA,
      ultimaTransferencia: { setorOrigem: "recepcao" as const, origemNome: null, resumo },
    });
    const cliente = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCabecalhoConversa("at-1", resumoDe("x".repeat(200))), {
      wrapper,
    });
    act(() => result.current.alternarResumo());
    expect(result.current.resumoAberto).toBe(true);

    act(() => {
      cliente.setQueryData(conversaKeys.conversa("at-1"), resumoDe("y".repeat(200)));
    });
    await waitFor(() => expect(result.current.contexto?.resumo).toBe("y".repeat(200)));
    expect(result.current.resumoAberto).toBe(false);
  });

  it("as mensagens chegam prontas para a View", () => {
    const { result } = renderHook(() => useMensagensConversa("at-1", CONVERSA), {
      wrapper: criarWrapper(),
    });

    expect(result.current.mensagens).toEqual([
      expect.objectContaining({ id: "m1", lado: "contato", autor: "Maria", texto: "oi" }),
    ]);
  });

  it("transferir numa região (ações) é percebido pela outra (cabeçalho), pelo cache de mutações", async () => {
    transferir.mockResolvedValue({ ok: true, data: {} as never });
    const wrapper = criarWrapper();
    const { result } = renderHook(
      () => ({
        transferencia: useTransferirAtendimentoMutation("at-1"),
        mensagens: useMensagensConversa("at-1", CONVERSA),
      }),
      { wrapper },
    );
    expect(obter).not.toHaveBeenCalled();

    act(() => result.current.transferencia.mutate({ setorDestino: "tributario", resumo: "x" }));

    await waitFor(() => expect(result.current.transferencia.isSuccess).toBe(true));
    // Transferida: a conversa deixa de ser atualizada.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(obter).not.toHaveBeenCalled();
  });
});

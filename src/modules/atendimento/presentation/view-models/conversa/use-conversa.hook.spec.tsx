import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import {
  obterConversaAction,
  renovarLinksDeAnexosAction,
  transferirAtendimentoAction,
} from "./conversa.actions";
import {
  conversaKeys,
  useConversaQuery,
  useTransferirAtendimentoMutation,
} from "./conversa.queries";
import { useCabecalhoConversa } from "./use-cabecalho-conversa.hook";
import { useMensagensConversa } from "./use-mensagens-conversa.hook";

// conversa.queries invalida as chaves da Fila e dos Meus atendimentos: importa os módulos delas.
jest.mock("@/main/client/upload-de-anexo.factory", () => ({ makeUploadDeAnexo: jest.fn() }));
jest.mock("../fila/fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));

jest.mock("./conversa.actions", () => ({
  enviarAnexoGuardadoAction: jest.fn(),
  enviarDocumentoAction: jest.fn(),
  enviarMensagemAction: jest.fn(),
  obterConversaAction: jest.fn(),
  renovarLinksDeAnexosAction: jest.fn(),
  transferirAtendimentoAction: jest.fn(),
}));

const obter = jest.mocked(obterConversaAction);
const transferir = jest.mocked(transferirAtendimentoAction);
const renovar = jest.mocked(renovarLinksDeAnexosAction);

const CONVERSA: ConversaVista = {
  atendimentoId: "at-1",
  encerrado: false,
  telefone: "5561988887777",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
  clienteVinculado: true,
  mensagens: [
    {
      id: "m1",
      autor: "contato",
      texto: "oi",
      criadoEm: "2026-10-08T15:30:00Z",
      atendente: null,
      reacao: null,
      entrega: "entregue",
      reagivel: false,
      anexo: null,
    },
  ],
  ultimaTransferencia: null,
  ura: null,
  temMaisAnteriores: false,
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

describe("renovação dos links de anexos do histórico já aberto", () => {
  const anexo = (url: string, expiraEm: string) => ({
    tipo: "documento" as const,
    nome: "balanco.pdf",
    tamanho: 1024,
    url,
    urlVisualizacao: `${url}-ver`,
    miniaturaUrl: null,
    expiraEm,
  });
  const mensagem = (id: string, comAnexo: ReturnType<typeof anexo> | null) => ({
    ...CONVERSA.mensagens[0],
    id,
    anexo: comAnexo,
  });

  beforeEach(() => {
    obter.mockReset();
    renovar.mockReset();
  });

  it("o polling renova só o anexo antigo que está para vencer, sem reassinar o resto", async () => {
    const venceEmBreve = new Date(Date.now() + 2 * 60_000).toISOString();
    const daqui1h = new Date(Date.now() + 60 * 60_000).toISOString();
    const velho = mensagem("m0", anexo("https://l/velho", venceEmBreve));
    const recente = mensagem("m1", null);
    const inicial = { ...CONVERSA, mensagens: [velho, recente], temMaisAnteriores: false };
    // A leitura do servidor traz só a janela recente (sem a Mensagem antiga).
    obter.mockResolvedValue({ ok: true, data: { ...CONVERSA, mensagens: [recente] } });
    renovar.mockResolvedValue({
      ok: true,
      data: [mensagem("m0", anexo("https://l/novo", daqui1h))],
    });

    const { result } = renderHook(() => useConversaQuery("at-1", inicial, false), {
      wrapper: criarWrapper(),
    });
    // O React Query só re-renderiza pelo que foi lido: a View lê `data`.
    expect(result.current.data).toBeDefined();
    await act(async () => {
      await result.current.refetch();
    });

    expect(renovar).toHaveBeenCalledTimes(1);
    expect(renovar).toHaveBeenCalledWith({ atendimentoId: "at-1", mensagemIds: ["m0"] });
    await waitFor(() =>
      expect(result.current.data?.mensagens.find((m) => m.id === "m0")?.anexo?.url).toBe(
        "https://l/novo",
      ),
    );
  });

  it("falha da renovação não derruba a leitura: o link antigo fica e a conversa segue", async () => {
    const venceEmBreve = new Date(Date.now() + 60_000).toISOString();
    const inicial = {
      ...CONVERSA,
      mensagens: [mensagem("m9", anexo("https://l/velho", venceEmBreve)), mensagem("m10", null)],
    };
    obter.mockResolvedValue({
      ok: true,
      data: { ...CONVERSA, mensagens: [mensagem("m10", null)] },
    });
    renovar.mockRejectedValue(new Error("rede"));

    const { result } = renderHook(() => useConversaQuery("at-1", inicial, false), {
      wrapper: criarWrapper(),
    });
    // O React Query só re-renderiza pelo que foi lido: a View lê `data`.
    expect(result.current.data).toBeDefined();
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.mensagens.find((m) => m.id === "m9")?.anexo?.url).toBe(
      "https://l/velho",
    );
  });
});

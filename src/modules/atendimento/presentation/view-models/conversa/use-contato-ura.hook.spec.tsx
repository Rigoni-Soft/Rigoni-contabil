import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { buscarClienteParaContatoUraAction, cadastrarContatoUraAction } from "./conversa.actions";
import { useContatoUra } from "./use-contato-ura.hook";

jest.mock("@/main/client/upload-de-anexo.factory", () => ({ makeUploadDeAnexo: jest.fn() }));
jest.mock("../fila/fila.actions", () => ({ listarFilaAction: jest.fn() }));
jest.mock("../meus-atendimentos/meus-atendimentos.actions", () => ({
  listarMeusAtendimentosAction: jest.fn(),
}));
jest.mock("./conversa.actions", () => ({
  buscarClienteParaContatoUraAction: jest.fn(),
  cadastrarContatoUraAction: jest.fn(),
}));

const buscar = jest.mocked(buscarClienteParaContatoUraAction);
const cadastrar = jest.mocked(cadastrarContatoUraAction);

const CLIENTE = { id: "cli-1", empresa: "Padaria Ltda", cnpj: "11444777000161" };

function renderizar() {
  return renderHook(() => useContatoUra("at-1"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    ),
  });
}

async function confirmarCliente(result: ReturnType<typeof renderizar>["result"]) {
  buscar.mockResolvedValue({ ok: true, data: CLIENTE });
  act(() => result.current.aoAbrir());
  act(() => result.current.aoBuscar("11.444.777/0001-61"));
  await waitFor(() => expect(result.current.etapa).toBe("contato"));
}

describe("useContatoUra", () => {
  beforeEach(() => {
    buscar.mockReset();
    cadastrar.mockReset();
  });

  it("começa fechado e abre na etapa do Cliente", () => {
    const { result } = renderizar();
    expect(result.current.etapa).toBe("fechado");
    act(() => result.current.aoAbrir());
    expect(result.current.etapa).toBe("cliente");
  });

  it("busca o Cliente pelo CNPJ digitado e passa a pedir nome e e-mail, com o CNPJ formatado", async () => {
    const { result } = renderizar();
    await confirmarCliente(result);
    expect(buscar).toHaveBeenCalledWith({ atendimentoId: "at-1", cnpj: "11.444.777/0001-61" });
    expect(result.current.cliente).toEqual({ empresa: "Padaria Ltda", cnpj: "11.444.777/0001-61" });
  });

  it("CNPJ sem Cliente mostra o erro e fica na etapa do Cliente", async () => {
    buscar.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "Nenhum Cliente com este CNPJ." },
    });
    const { result } = renderizar();
    act(() => result.current.aoAbrir());
    act(() => result.current.aoBuscar("29700009000100"));
    await waitFor(() =>
      expect(result.current.aviso).toEqual({
        tipo: "erro",
        texto: "Nenhum Cliente com este CNPJ.",
      }),
    );
    expect(result.current.etapa).toBe("cliente");
  });

  it("cadastra o contato do Cliente confirmado e conclui com o aviso de sucesso", async () => {
    cadastrar.mockResolvedValue({
      ok: true,
      data: { status: "criado", contatoId: "ct-1", nome: "Maria" },
    });
    const { result } = renderizar();
    await confirmarCliente(result);

    act(() => result.current.aoCadastrar("Maria", ""));

    await waitFor(() => expect(result.current.concluido).toBe(true));
    expect(cadastrar).toHaveBeenCalledWith({
      atendimentoId: "at-1",
      clienteId: "cli-1",
      nome: "Maria",
      email: "",
    });
    expect(result.current.etapa).toBe("fechado");
    expect(result.current.aviso).toEqual({
      tipo: "sucesso",
      texto: "Maria cadastrado como contato de Padaria Ltda.",
    });
  });

  it("número em outro Cliente avisa, não conclui e mantém o formulário para trocar o Cliente", async () => {
    cadastrar.mockResolvedValue({ ok: true, data: { status: "em_outro_cliente" } });
    const { result } = renderizar();
    await confirmarCliente(result);

    act(() => result.current.aoCadastrar("Maria", ""));

    await waitFor(() => expect(result.current.aviso?.tipo).toBe("erro"));
    expect(result.current.concluido).toBe(false);
    expect(result.current.etapa).toBe("contato");
  });

  it("trocar o Cliente volta à etapa do Cliente sem o aviso anterior", async () => {
    cadastrar.mockResolvedValue({ ok: true, data: { status: "em_outro_cliente" } });
    const { result } = renderizar();
    await confirmarCliente(result);
    act(() => result.current.aoCadastrar("Maria", ""));
    await waitFor(() => expect(result.current.aviso).toBeDefined());

    act(() => result.current.aoTrocarCliente());

    expect(result.current.etapa).toBe("cliente");
    expect(result.current.aviso).toBeUndefined();
  });

  it("cancelar fecha o painel e esquece o Cliente", async () => {
    const { result } = renderizar();
    await confirmarCliente(result);
    act(() => result.current.aoCancelar());
    expect(result.current.etapa).toBe("fechado");
    expect(result.current.cliente).toBeUndefined();
  });
});

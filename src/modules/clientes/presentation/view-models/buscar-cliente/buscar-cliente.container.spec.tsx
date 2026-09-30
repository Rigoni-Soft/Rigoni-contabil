import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { BuscarClienteContainer } from "./buscar-cliente.container";

const buscarClientesActionMock = jest.fn();
const carregarCadastroOperacionalActionMock = jest.fn();

jest.mock("./buscar-cliente.actions", () => ({
  buscarClientesAction: (input: unknown) => buscarClientesActionMock(input),
  carregarCadastroOperacionalAction: (id: string) => carregarCadastroOperacionalActionMock(id),
}));

jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: jest.fn() }),
}));

const CADASTRO: CadastroOperacionalClienteDto = {
  id: "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [],
  documentoObrigatorio: null,
  dasStatus: null,
  dataEnvioDas: null,
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: false, servico: false },
};

// Sem retry: com fake timers, o backoff de retry do React Query enfileira
// setTimeout extras que os testes não avançam, travando o findBy.
function renderComQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BuscarClienteContainer papel="admin" setor="administrativo" />
    </QueryClientProvider>,
  );
}

describe("BuscarClienteContainer", () => {
  beforeEach(() => {
    buscarClientesActionMock.mockReset();
    carregarCadastroOperacionalActionMock.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("digitar menos de 3 caracteres não chama a action", async () => {
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pã");
    act(() => jest.advanceTimersByTime(500));

    expect(buscarClientesActionMock).not.toHaveBeenCalled();
  });

  it("digitar 3+ caracteres chama buscarClientesAction após o debounce", async () => {
    buscarClientesActionMock.mockResolvedValue({ ok: true, data: [] });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(buscarClientesActionMock).toHaveBeenCalledWith({ termo: "Pão" });
  });

  it("mostra 'Buscando...' enquanto a query está em andamento", async () => {
    let resolver: (value: { ok: true; data: [] }) => void = () => {};
    buscarClientesActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getAllByText("Buscando...").length).toBeGreaterThan(0);

    await act(async () => {
      resolver({ ok: true, data: [] });
    });

    await waitFor(() => {
      expect(screen.queryAllByText("Buscando...")).toHaveLength(0);
    });
  });

  it("buscar o mesmo termo de novo usa o cache do React Query e não duplica a chamada", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();
    const input = screen.getByLabelText(/empresa ou cnpj/i);

    await usuario.type(input, "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(buscarClientesActionMock).toHaveBeenCalledTimes(1);

    await usuario.clear(input);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await usuario.type(input, "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(buscarClientesActionMock).toHaveBeenCalledTimes(1);
  });

  it("quando a action falha, as sugestões ficam vazias e a tela não quebra", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "falhou" },
    });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("clicar numa sugestão chama carregarCadastroOperacionalAction e renderiza o form de edição", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await usuario.click(await screen.findByText(CADASTRO.empresa));

    expect(carregarCadastroOperacionalActionMock).toHaveBeenCalledWith(CADASTRO.id);
    expect(await screen.findByLabelText(/forma de envio/i)).toBeInTheDocument();
  });

  it("o campo de busca é um combobox acessível ligado à lista de sugestões", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();
    const input = screen.getByLabelText(/empresa ou cnpj/i);

    expect(input).toHaveAttribute("aria-expanded", "false");

    await usuario.type(input, "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await screen.findByText(CADASTRO.empresa);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "buscar-cliente-lista");
    expect(screen.getByRole("listbox")).toHaveAttribute("id", "buscar-cliente-lista");
    expect(screen.getByRole("option")).toBeInTheDocument();
  });

  it("ArrowDown destaca a sugestão e Enter seleciona o cliente destacado", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();
    const input = screen.getByLabelText(/empresa ou cnpj/i);

    await usuario.type(input, "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await screen.findByText(CADASTRO.empresa);

    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");

    await usuario.keyboard("{Enter}");

    expect(carregarCadastroOperacionalActionMock).toHaveBeenCalledWith(CADASTRO.id);
    expect(await screen.findByLabelText(/forma de envio/i)).toBeInTheDocument();
  });

  it("selecionar um cliente move o foco pro título do painel", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await usuario.click(await screen.findByText(CADASTRO.empresa));

    const titulo = await screen.findByRole("heading", { name: "Editar cadastro operacional" });
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("clicar em Cancelar dentro do form fecha o painel e volta pro campo de busca", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await usuario.click(await screen.findByText(CADASTRO.empresa));
    await screen.findByLabelText(/forma de envio/i);

    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByLabelText(/empresa ou cnpj/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/forma de envio/i)).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { BuscarClienteContainer } from "./buscar-cliente.container";

const routerRefresh = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

const buscarClientesActionMock = jest.fn();
const carregarCadastroOperacionalActionMock = jest.fn();

jest.mock("./buscar-cliente.actions", () => ({
  buscarClientesAction: (input: unknown) => buscarClientesActionMock(input),
  carregarCadastroOperacionalAction: (id: string) => carregarCadastroOperacionalActionMock(id),
}));

const editarExecuteMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: editarExecuteMock }),
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
  parcelamentos: [],
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: false, servico: false },
  responsavelId: null,
  responsavelNome: null,
};

// Sem retry: com fake timers, o backoff de retry do React Query enfileira
// setTimeout extras que os testes não avançam, travando o findBy.
// Padrão: Funcionário do Simples Nacional (edita no painel embutido); o Admin vai à tela própria.
function renderComQueryClient(papel = "funcionario", setor = "simples_nacional") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BuscarClienteContainer papel={papel} setor={setor} />
    </QueryClientProvider>,
  );
}

describe("BuscarClienteContainer", () => {
  beforeEach(() => {
    buscarClientesActionMock.mockReset();
    carregarCadastroOperacionalActionMock.mockReset();
    editarExecuteMock.mockReset();
    routerRefresh.mockReset();
    routerPush.mockReset();
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

    expect(buscarClientesActionMock).toHaveBeenCalledWith({ termo: "Pão", apenasSnMei: false });
  });

  it("com apenasSnMei=true (busca do dashboard do SN), repassa a flag pra action", async () => {
    buscarClientesActionMock.mockResolvedValue({ ok: true, data: [] });
    const usuario = userEvent.setup({ delay: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BuscarClienteContainer papel="funcionario" setor="simples_nacional" apenasSnMei />
      </QueryClientProvider>,
    );

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(buscarClientesActionMock).toHaveBeenCalledWith({ termo: "Pão", apenasSnMei: true });
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

  it("Admin, ao escolher um Cliente, vai à tela própria dele em vez do painel embutido", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient("admin", "administrativo");

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await usuario.click(await screen.findByText(CADASTRO.empresa));

    expect(routerPush).toHaveBeenCalledWith(`/clientes/${CADASTRO.id}`);
    expect(carregarCadastroOperacionalActionMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/forma de envio/i)).not.toBeInTheDocument();
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

  // Salvar precisa fechar o painel (volta pra busca) e atualizar os dados da página — se esta busca
  // estiver embutida no resumo do setor, os cards refletem a mudança na hora.
  it("salvar fecha o painel, volta pro campo de busca e atualiza a página (router.refresh)", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    editarExecuteMock.mockResolvedValue({ ok: true, value: { clienteId: CADASTRO.id } });
    const usuario = userEvent.setup({ delay: null });
    renderComQueryClient();

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await usuario.click(await screen.findByText(CADASTRO.empresa));
    await screen.findByLabelText(/forma de envio/i);

    await usuario.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByLabelText(/empresa ou cnpj/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/forma de envio/i)).not.toBeInTheDocument();
    expect(routerRefresh).toHaveBeenCalled();
  });
});

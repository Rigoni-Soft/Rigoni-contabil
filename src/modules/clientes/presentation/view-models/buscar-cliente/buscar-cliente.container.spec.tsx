import { act, render, screen } from "@testing-library/react";
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
    render(<BuscarClienteContainer papel="admin" setor="administrativo" />);

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pã");
    act(() => jest.advanceTimersByTime(500));

    expect(buscarClientesActionMock).not.toHaveBeenCalled();
  });

  it("digitar 3+ caracteres chama buscarClientesAction após o debounce", async () => {
    buscarClientesActionMock.mockResolvedValue({ ok: true, data: [] });
    const usuario = userEvent.setup({ delay: null });
    render(<BuscarClienteContainer papel="admin" setor="administrativo" />);

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(buscarClientesActionMock).toHaveBeenCalledWith({ termo: "Pão" });
  });

  it("clicar numa sugestão chama carregarCadastroOperacionalAction e renderiza o form de edição", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    render(<BuscarClienteContainer papel="admin" setor="administrativo" />);

    await usuario.type(screen.getByLabelText(/empresa ou cnpj/i), "Pão");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await usuario.click(await screen.findByText(CADASTRO.empresa));

    expect(carregarCadastroOperacionalActionMock).toHaveBeenCalledWith(CADASTRO.id);
    expect(await screen.findByLabelText(/forma de envio/i)).toBeInTheDocument();
  });

  it("clicar em Cancelar dentro do form fecha o painel e volta pro campo de busca", async () => {
    buscarClientesActionMock.mockResolvedValue({
      ok: true,
      data: [{ id: CADASTRO.id, empresa: CADASTRO.empresa, cnpj: CADASTRO.cnpj }],
    });
    carregarCadastroOperacionalActionMock.mockResolvedValue({ ok: true, data: CADASTRO });
    const usuario = userEvent.setup({ delay: null });
    render(<BuscarClienteContainer papel="admin" setor="administrativo" />);

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

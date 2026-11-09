import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroRhClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";
import { EditarCadastroRhContainer } from "./editar-cadastro-rh.container";

jest.mock("./editar-cadastro-rh.actions", () => {
  const real = jest.requireActual("./editar-cadastro-rh.actions");
  return { ...real, editarCadastroRhAction: jest.fn(real.editarCadastroRhAction) };
});

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: jest.fn() }),
}));

const executeMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroRhCliente: () => ({ execute: executeMock }),
  makeListarDocumentosContratuaisCliente: () => ({ execute: async () => ok([]) }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

const dados: CadastroRhClienteDto = {
  id: "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11.444.777/0001-61",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
  observacoes: "Folha no 5º dia útil.",
};

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const montar = (props: Partial<React.ComponentProps<typeof EditarCadastroRhContainer>> = {}) =>
  render(<EditarCadastroRhContainer dados={dados} readOnly={false} voltarHref="/rh" {...props} />);

describe("EditarCadastroRhContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
  });

  it("mostra empresa, CNPJ, contatos e as observações do RH, sem Regime nem campos do SN", async () => {
    montar();

    expect(await screen.findByDisplayValue("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações gerais do RH")).toHaveValue("Folha no 5º dia útil.");
    expect(screen.getByDisplayValue("Maria")).toBeInTheDocument();
    expect(screen.queryByLabelText("Regime")).not.toBeInTheDocument();
    expect(screen.queryByText(/DAS/)).not.toBeInTheDocument();
  });

  it("salvar envia só as observações do RH e os contatos e volta para a lista de origem", async () => {
    montar();
    const usuario = userEvent.setup();

    const observacoes = await screen.findByLabelText("Observações gerais do RH");
    await usuario.clear(observacoes);
    await usuario.type(observacoes, "Pagar no dia 10.");
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/rh"));
    const enviado = jest.mocked(editarCadastroRhAction).mock.calls.at(-1)?.[0];
    expect(enviado).toEqual({
      clienteId: dados.id,
      observacoes: "Pagar no dia 10.",
      contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
    });
  });

  it("mostra a recusa do servidor e não navega", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Você não é o Responsável do RH.")));
    montar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Você não é o Responsável do RH.")).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("somente leitura não oferece Salvar", async () => {
    montar({ readOnly: true });

    expect(await screen.findByDisplayValue("Padaria Pão Quente Ltda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  });

  it("cliente inexistente avisa", () => {
    montar({ dados: null });

    expect(screen.getByText("Cliente não encontrado.")).toBeInTheDocument();
  });
});

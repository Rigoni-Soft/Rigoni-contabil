import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";
import { ObservacoesDoRhContainer } from "./observacoes-do-rh.container";

jest.mock("./editar-cadastro-rh.actions", () => {
  const real = jest.requireActual("./editar-cadastro-rh.actions");
  return { ...real, editarCadastroRhAction: jest.fn(real.editarCadastroRhAction) };
});

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const executeMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroRhCliente: () => ({ execute: executeMock }),
}));

const CLIENTE = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";

describe("ObservacoesDoRhContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeMock.mockResolvedValue(ok({ clienteId: CLIENTE }));
  });

  it("salva só as observações, sem os contatos, e recarrega a tela", async () => {
    render(<ObservacoesDoRhContainer clienteId={CLIENTE} observacoesIniciais="Antiga." />);
    const usuario = userEvent.setup();

    const campo = screen.getByLabelText("Observações gerais do RH");
    await usuario.clear(campo);
    await usuario.type(campo, "Nova.");
    await usuario.click(screen.getByRole("button", { name: "Salvar observações do RH" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(jest.mocked(editarCadastroRhAction).mock.calls.at(-1)?.[0]).toEqual({
      clienteId: CLIENTE,
      observacoes: "Nova.",
    });
    expect(await screen.findByText("Observações do RH atualizadas.")).toBeInTheDocument();
  });

  it("mostra a recusa do servidor e não recarrega", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));
    render(<ObservacoesDoRhContainer clienteId={CLIENTE} observacoesIniciais="" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar observações do RH" }));

    expect(await screen.findByText("Sem permissão.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    [new TypeError("fetch"), "Sem conexão com o servidor"],
    [new Error("boom"), "Erro inesperado no servidor"],
  ])("falha de transporte (%s) mostra a causa", async (falha, texto) => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(editarCadastroRhAction).mockRejectedValueOnce(falha);
    render(<ObservacoesDoRhContainer clienteId={CLIENTE} observacoesIniciais="" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar observações do RH" }));

    expect(await screen.findByText(new RegExp(texto))).toBeInTheDocument();
  });
});

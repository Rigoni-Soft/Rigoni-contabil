import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ok } from "@/shared/kernel/result";

import { CriarUsuarioContainer } from "./criar-usuario.container";

const executeMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeCriarUsuario: () => ({ execute: executeMock }),
}));

describe("CriarUsuarioContainer", () => {
  beforeEach(() => executeMock.mockReset());

  it("submete o formulário preenchido e mostra a senha provisória devolvida pelo caso de uso", async () => {
    executeMock.mockResolvedValue(
      ok({
        usuario: {
          id: "1",
          nome: "Jéssica Souza",
          email: "jessica@rigonicontabil.local",
          papel: "funcionario",
          setor: "simples_nacional",
        },
        senhaProvisoria: "ABCDEFGHJKLM",
      }),
    );
    const usuario = userEvent.setup();
    render(<CriarUsuarioContainer />);

    await usuario.type(screen.getByLabelText("Nome"), "Jéssica Souza");
    await usuario.type(screen.getByLabelText("E-mail"), "jessica@rigonicontabil.local");
    await usuario.selectOptions(screen.getByLabelText("Papel"), "funcionario");
    await usuario.selectOptions(screen.getByLabelText("Setor"), "simples_nacional");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("ABCDEFGHJKLM")).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});

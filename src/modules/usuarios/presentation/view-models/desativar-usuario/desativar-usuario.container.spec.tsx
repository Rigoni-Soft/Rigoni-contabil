import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DesativarUsuarioContainer } from "./desativar-usuario.container";

const useHookMock = jest.fn();

jest.mock("./use-desativar-usuario.hook", () => ({
  useDesativarUsuario: (id: string) => useHookMock(id),
}));

describe("DesativarUsuarioContainer", () => {
  it("liga o hook do usuário à View", async () => {
    const aoPedirConfirmacao = jest.fn();
    useHookMock.mockReturnValue({
      confirmando: false,
      pendente: false,
      erro: undefined,
      aoPedirConfirmacao,
      aoCancelar: jest.fn(),
      aoConfirmar: jest.fn(),
    });
    render(<DesativarUsuarioContainer usuarioId="u1" nome="Jéssica" />);

    await userEvent.click(screen.getByRole("button", { name: "Desativar Jéssica" }));

    expect(useHookMock).toHaveBeenCalledWith("u1");
    expect(aoPedirConfirmacao).toHaveBeenCalled();
  });
});

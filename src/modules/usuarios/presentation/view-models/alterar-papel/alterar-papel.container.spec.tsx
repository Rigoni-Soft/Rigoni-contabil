import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AlterarPapelContainer } from "./alterar-papel.container";

const useHookMock = jest.fn();

jest.mock("./use-alterar-papel.hook", () => ({
  useAlterarPapel: (...args: unknown[]) => useHookMock(...args),
}));

describe("AlterarPapelContainer", () => {
  it("liga o hook do usuário à View", async () => {
    const aoAlterar = jest.fn();
    useHookMock.mockReturnValue({ pendente: false, erro: undefined, aoAlterar });
    render(<AlterarPapelContainer usuarioId="u1" nome="Jéssica" papel="funcionario" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Promover Jéssica a Líder de setor" }),
    );

    expect(useHookMock).toHaveBeenCalledWith("u1", "funcionario");
    expect(aoAlterar).toHaveBeenCalled();
  });
});

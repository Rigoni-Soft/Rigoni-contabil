import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LogoutButtonContainer } from "./logout-button.container";

const logoutActionMock = jest.fn();
jest.mock("./logout.actions", () => ({
  logoutAction: (...args: unknown[]) => logoutActionMock(...args),
}));

describe("LogoutButtonContainer", () => {
  beforeEach(() => {
    logoutActionMock.mockReset();
  });

  it("mostra aviso visível quando encerrar a sessão falha, sem confirmar saída", async () => {
    logoutActionMock.mockResolvedValue({ erro: "Não foi possível sair. Tente novamente." });
    const usuario = userEvent.setup();
    render(<LogoutButtonContainer />);

    await usuario.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível sair. Tente novamente.",
    );
  });
});

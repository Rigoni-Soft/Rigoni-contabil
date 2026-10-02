import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TrocarSenhaContainer } from "./trocar-senha.container";

const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const trocarSenhaActionMock = jest.fn();
jest.mock("./trocar-senha.actions", () => ({
  trocarSenhaAction: (v: unknown) => trocarSenhaActionMock(v),
}));

async function submeter(
  usuario: ReturnType<typeof userEvent.setup>,
  novaSenha = "senha-nova-123",
  confirmacao = novaSenha,
) {
  await usuario.type(screen.getByLabelText("Nova senha"), novaSenha);
  await usuario.type(screen.getByLabelText("Confirmar nova senha"), confirmacao);
  await usuario.click(screen.getByRole("button", { name: "Trocar senha" }));
}

describe("TrocarSenhaContainer", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    trocarSenhaActionMock.mockReset();
  });

  it("mostra erro de validação quando as senhas não coincidem, sem chamar a Server Action", async () => {
    const usuario = userEvent.setup();
    render(<TrocarSenhaContainer />);

    await submeter(usuario, "senha-nova-123", "outra-coisa");

    expect(await screen.findByText("As senhas não coincidem")).toBeVisible();
    expect(trocarSenhaActionMock).not.toHaveBeenCalled();
  });

  it("navega pra / quando a troca funciona", async () => {
    trocarSenhaActionMock.mockResolvedValue({ ok: true, data: undefined });
    const usuario = userEvent.setup();
    render(<TrocarSenhaContainer />);

    await submeter(usuario);

    expect(push).toHaveBeenCalledWith("/");
  });

  it("mostra o erro do servidor e não navega quando a troca falha", async () => {
    trocarSenhaActionMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Sessão inválida." },
    });
    const usuario = userEvent.setup();
    render(<TrocarSenhaContainer />);

    await submeter(usuario);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sessão inválida.");
    expect(push).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginContainer } from "./login.container";

const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const loginActionMock = jest.fn();
jest.mock("./login.actions", () => ({
  loginAction: (v: unknown) => loginActionMock(v),
}));

async function submeter(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText("E-mail"), "admin@rigonicontabil.local");
  await usuario.type(screen.getByLabelText("Senha"), "admin123");
  await usuario.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginContainer", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    loginActionMock.mockReset();
  });

  it("não trava em 'Entrando…' quando a Server Action lança uma exceção inesperada", async () => {
    loginActionMock.mockRejectedValue(new Error("falha de rede inesperada"));
    const usuario = userEvent.setup();
    render(<LoginContainer />);

    await submeter(usuario);

    expect(await screen.findByRole("alert")).toHaveTextContent(/falha inesperada/i);
    expect(screen.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
  });

  it("navega pra / quando o login funciona", async () => {
    loginActionMock.mockResolvedValue({
      ok: true,
      data: {
        id: "1",
        nome: "Admin",
        email: "admin@rigonicontabil.local",
        papel: "admin",
        setor: "administrativo",
      },
    });
    const usuario = userEvent.setup();
    render(<LoginContainer />);

    await submeter(usuario);

    expect(push).toHaveBeenCalledWith("/");
  });
});

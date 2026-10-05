import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("começa oculto e alterna entre exibir e ocultar o valor, expondo o estado no botão", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Campo" />);
    const campo = screen.getByLabelText("Campo");
    const botao = screen.getByRole("button", { name: "Mostrar caracteres" });

    expect(campo).toHaveAttribute("type", "password");
    expect(botao).toHaveAttribute("aria-pressed", "false");

    await user.click(botao);
    expect(campo).toHaveAttribute("type", "text");
    expect(botao).toHaveAttribute("aria-pressed", "true");

    await user.click(botao);
    expect(campo).toHaveAttribute("type", "password");
  });
});

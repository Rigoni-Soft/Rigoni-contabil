import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("começa oculto e alterna entre exibir e ocultar o valor", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Campo" />);
    const campo = screen.getByLabelText("Campo");

    expect(campo).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar caracteres" }));
    expect(campo).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar caracteres" }));
    expect(campo).toHaveAttribute("type", "password");
  });
});

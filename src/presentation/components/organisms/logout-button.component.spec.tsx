import { render, screen } from "@testing-library/react";

import { LogoutButton } from "./logout-button.component";

describe("LogoutButton", () => {
  it("mostra aviso visível quando erro é informado (devolutiva #55, ponto 04)", () => {
    render(<LogoutButton formAction={jest.fn()} pendente={false} erro="Não foi possível sair." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair.");
  });

  it("não mostra aviso sem erro", () => {
    render(<LogoutButton formAction={jest.fn()} pendente={false} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("desabilita o botão enquanto pendente", () => {
    render(<LogoutButton formAction={jest.fn()} pendente />);

    expect(screen.getByRole("button", { name: "Sair" })).toBeDisabled();
  });
});

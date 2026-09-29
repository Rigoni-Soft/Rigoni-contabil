import { render, screen } from "@testing-library/react";

import { ShellNav } from "./shell-nav.component";

describe("ShellNav", () => {
  it("Admin vê todos os setores recebidos", () => {
    render(
      <ShellNav
        setores={[{ slug: "simples_nacional" }, { slug: "financeiro" }, { slug: "administrativo" }]}
      />,
    );

    expect(screen.getByText("Simples Nacional")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Administrativo")).toBeInTheDocument();
  });

  it("Funcionário/Líder vê só o próprio setor (a lista já vem filtrada do caso de uso)", () => {
    render(<ShellNav setores={[{ slug: "simples_nacional" }]} />);

    expect(screen.getByText("Simples Nacional")).toBeInTheDocument();
    expect(screen.queryByText("Financeiro")).not.toBeInTheDocument();
  });

  it("marca cada setor como indisponível (nenhuma tela existe ainda)", () => {
    render(<ShellNav setores={[{ slug: "simples_nacional" }]} />);

    const item = screen.getByText("Simples Nacional");
    expect(item).toHaveAttribute("aria-disabled", "true");
  });
});

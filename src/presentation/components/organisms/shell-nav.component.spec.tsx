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

  it("Simples Nacional é um link de verdade pro dashboard exclusivo (#36)", () => {
    render(<ShellNav setores={[{ slug: "simples_nacional" }]} />);

    expect(screen.getByRole("link", { name: "Simples Nacional" })).toHaveAttribute(
      "href",
      "/simples-nacional",
    );
  });

  it("marca os demais setores como indisponíveis (nenhuma tela existe ainda)", () => {
    render(<ShellNav setores={[{ slug: "financeiro" }]} />);

    const item = screen.getByText("Financeiro");
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("só a aba da tela aberta fica selecionada; em '/' nenhuma", () => {
    const { rerender } = render(<ShellNav setores={[{ slug: "simples_nacional" }]} />);
    expect(screen.getByRole("link", { name: "Simples Nacional" })).not.toHaveAttribute(
      "aria-current",
    );

    rerender(<ShellNav setores={[{ slug: "simples_nacional" }]} rotaAtual="/simples-nacional" />);
    expect(screen.getByRole("link", { name: "Simples Nacional" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("tem a aba 'Atendimento' para a tela de Atendimento, ao lado das de Setor", () => {
    render(<ShellNav setores={[{ slug: "financeiro" }]} />);

    expect(screen.getByRole("link", { name: "Atendimento" })).toHaveAttribute(
      "href",
      "/atendimento",
    );
  });

  it("marca a aba 'Atendimento' como a página atual quando é a tela aberta", () => {
    render(<ShellNav setores={[{ slug: "financeiro" }]} rotaAtual="/atendimento" />);

    expect(screen.getByRole("link", { name: "Atendimento" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

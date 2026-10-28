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

describe("ShellNav — pendentes de Atendimento (#163)", () => {
  it("mostra o contador no link e o diz por extenso no nome acessível", () => {
    render(<ShellNav setores={[]} pendentesDeAtendimento={3} />);

    const link = screen.getByRole("link", { name: "Atendimento, 3 pendentes" });
    expect(link).toHaveAttribute("href", "/atendimento");
    expect(link).toHaveTextContent("3");
  });

  it("sem pendentes o link fica sem contador e com o nome de sempre", () => {
    render(<ShellNav setores={[]} pendentesDeAtendimento={0} />);

    expect(screen.getByRole("link", { name: "Atendimento" })).toBeInTheDocument();
  });

  it("um pendente fala no singular", () => {
    render(<ShellNav setores={[]} pendentesDeAtendimento={1} />);

    expect(screen.getByRole("link", { name: "Atendimento, 1 pendente" })).toBeInTheDocument();
  });

  it("acima de 99 a pílula mostra 99+ e o nome acessível traz o número inteiro", () => {
    render(<ShellNav setores={[]} pendentesDeAtendimento={120} />);

    const link = screen.getByRole("link", { name: "Atendimento, 120 pendentes" });
    expect(link).toHaveTextContent("99+");
    expect(link).not.toHaveTextContent("120");
  });

  it("diz o aviso numa região de status para leitor de tela, que existe mesmo vazia", () => {
    const { rerender } = render(<ShellNav setores={[]} anuncio="" />);
    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    rerender(<ShellNav setores={[]} anuncio="Atendimento: 3 pendentes." />);

    expect(screen.getByRole("status")).toHaveTextContent("Atendimento: 3 pendentes.");
  });
});

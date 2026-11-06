import { render, screen } from "@testing-library/react";

import { TelaDeTrabalhoTemplate } from "./tela-de-trabalho-template.component";

describe("TelaDeTrabalhoTemplate", () => {
  it("monta cabeçalho, nav, cabeçalho da tela e conteúdo nos slots", () => {
    render(
      <TelaDeTrabalhoTemplate
        header={<header>topo</header>}
        nav={<nav>abas</nav>}
        largura="lista"
        cabecalho={<h1>Usuários</h1>}
        conteudo={<p>lista</p>}
      />,
    );

    expect(screen.getByText("topo")).toBeInTheDocument();
    expect(screen.getByText("abas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("lista")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("cabeçalho e navegação da aplicação ficam fora do main", () => {
    render(
      <TelaDeTrabalhoTemplate
        header={<header>topo</header>}
        nav={<nav>abas</nav>}
        largura="lista"
        conteudo="x"
      />,
    );

    const main = screen.getByRole("main");
    expect(main).not.toContainElement(screen.getByText("topo"));
    expect(main).not.toContainElement(screen.getByText("abas"));
  });

  it("a largura vem da categoria da tela", () => {
    render(<TelaDeTrabalhoTemplate header={null} largura="cadastro" conteudo="x" />);

    expect(screen.getByRole("main")).toHaveClass("max-w-4xl");
  });
});

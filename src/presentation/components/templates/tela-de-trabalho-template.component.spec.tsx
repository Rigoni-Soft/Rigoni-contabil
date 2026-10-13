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

  it("a largura vem da categoria da tela", () => {
    const { container } = render(
      <TelaDeTrabalhoTemplate header={null} largura="formulario" conteudo="x" />,
    );

    expect(container.querySelector("main > div")).toHaveClass("w-[80%]");
  });
});
